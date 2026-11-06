import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  ensureConversationsReady,
  PostgresConversationRepository,
} from '../dist/adapters/postgres/conversation-repository.js';
import { getBoss, getPool } from '../dist/adapters/postgres/runtime.js';

const ids = {
  customer: randomUUID(),
  conversation: randomUUID(),
  message: randomUUID(),
  handoff: randomUUID(),
  event: `synthetic-expiry-${randomUUID()}`,
  messageProvider: `synthetic-message-${randomUUID()}`,
  handoffKey: `synthetic-handoff-${randomUUID()}`,
  receipt: `synthetic-receipt-${randomUUID()}`,
};
const now = new Date();
const closedAt = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1_000).toISOString();
const createdAt = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1_000).toISOString();
let checksPassed = false;
let pool;

try {
  await ensureConversationsReady();
  pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO conversation_customers (customer_id, channel_id, external_customer_id, created_at)
       VALUES ($1, 'whatsapp:synthetic-retention-test', 'synthetic-retention-customer', $2)`,
      [ids.customer, createdAt],
    );
    await client.query(
      `INSERT INTO conversations (
         conversation_id, customer_id, state, created_at, last_inbound_at,
         last_inbound_received_at, closed_at
       ) VALUES ($1, $2, 'closed', $3, $4, $4, $5)`,
      [ids.conversation, ids.customer, createdAt, closedAt, closedAt],
    );
    await client.query(
      `INSERT INTO conversation_messages (
         message_id, conversation_id, customer_id, direction, kind, source, text,
         provider_message_id, idempotency_key, delivery_state, occurred_at, created_at
       ) VALUES ($1, $2, $3, 'inbound', 'text', 'whatsapp', 'synthetic retention fixture',
         $4, $5, 'accepted', $6, $6)`,
      [ids.message, ids.conversation, ids.customer, ids.messageProvider, `inbound:${ids.event}`, closedAt],
    );
    await client.query(
      `INSERT INTO conversation_inbound_events (
         provider_event_id, customer_id, conversation_id, inbound_message_id,
         conversation_started_at, received_at
       ) VALUES ($1, $2, $3, $4, $5, $5)`,
      [ids.event, ids.customer, ids.conversation, ids.message, closedAt],
    );
    await client.query(
      `INSERT INTO conversation_handoffs (handoff_id, idempotency_key, envelope, created_at)
       VALUES ($1, $2, $3::jsonb, $4)`,
      [ids.handoff, ids.handoffKey, JSON.stringify({ conversationId: ids.conversation }), closedAt],
    );
    await client.query(
      `INSERT INTO conversation_delivery_receipts (
         provider_event_id, provider_message_id, state, occurred_at, created_at
       ) VALUES ($1, $2, 'delivered', $3, $3)`,
      [ids.receipt, ids.messageProvider, closedAt],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  const deleted = await new PostgresConversationRepository().purgeExpired(now.toISOString());
  assert.equal(deleted, 1, 'the expired conversation should be deleted');

  const remaining = await pool.query(
    `SELECT
       (SELECT count(*) FROM conversation_customers WHERE customer_id = $1) AS customers,
       (SELECT count(*) FROM conversations WHERE conversation_id = $2) AS conversations,
       (SELECT count(*) FROM conversation_messages WHERE message_id = $3) AS messages,
       (SELECT count(*) FROM conversation_inbound_events WHERE provider_event_id = $4) AS events,
       (SELECT count(*) FROM conversation_handoffs WHERE idempotency_key = $5) AS handoffs,
       (SELECT count(*) FROM conversation_delivery_receipts WHERE provider_event_id = $6) AS receipts`,
    [ids.customer, ids.conversation, ids.message, ids.event, ids.handoffKey, ids.receipt],
  );
  assert.deepEqual(remaining.rows[0], {
    customers: '0', conversations: '0', messages: '0', events: '0', handoffs: '0', receipts: '0',
  });
  checksPassed = true;
  console.info(JSON.stringify({ check: 'epic3_postgres_retention', status: 'passed' }));
} finally {
  if (pool) {
    await pool.query('DELETE FROM conversation_handoffs WHERE idempotency_key = $1', [ids.handoffKey]);
    await pool.query('DELETE FROM conversation_delivery_receipts WHERE provider_event_id = $1', [ids.receipt]);
    await pool.query('DELETE FROM conversation_customers WHERE customer_id = $1', [ids.customer]);
    await getBoss().stop();
    await pool.end();
  }
  if (!checksPassed) console.error('EPIC3_POSTGRES_RETENTION_FAILED');
}
