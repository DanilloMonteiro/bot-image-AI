import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { getBoss, getPool, startBoss, transactionDb } from './runtime';
import { isHandoffContractV1, type HandoffContractV1 } from '../../contracts/conversations/v1';
import { CONVERSATION_OUTBOUND_MAX_RETRIES } from '../../modules/conversations/repository';
import type {
  ConversationContext,
  ConversationDecision,
  ConversationDeliveryState,
  ConversationRepository,
  DeliveryClaim,
  DeliveryReceipt,
  InboundMessage,
  InboundProcessResult,
  OutboundMessage,
  VoiceAuthorization,
} from '../../modules/conversations/repository';

export const CONVERSATION_OUTBOUND_QUEUE = 'conversation-outbound';
const IDLE_CLOSE_MS = 24 * 60 * 60 * 1000;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const DELIVERY_RANK: Record<ConversationDeliveryState, number> = {
  prepared: 0, accepted: 1, failed: 2, delivered: 3, read: 4,
};

let ready: Promise<void> | undefined;

export function ensureConversationsReady(): Promise<void> {
  ready ??= (async () => {
    await startBoss();
    const pool = getPool();
    await pool.query(`CREATE TABLE IF NOT EXISTS conversation_customers (
      customer_id uuid PRIMARY KEY,
      channel_id text NOT NULL,
      external_customer_id text NOT NULL,
      opted_out_at timestamptz,
      created_at timestamptz NOT NULL,
      UNIQUE (channel_id, external_customer_id)
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversations (
      conversation_id uuid PRIMARY KEY,
      customer_id uuid NOT NULL REFERENCES conversation_customers(customer_id),
      state text NOT NULL CHECK (state IN ('open', 'closed')),
      created_at timestamptz NOT NULL,
      last_inbound_at timestamptz NOT NULL,
      last_inbound_received_at timestamptz NOT NULL,
      closed_at timestamptz,
      adult_confirmed boolean,
      owns_photo_confirmed boolean,
      eligibility_prompted text CHECK (eligibility_prompted IN ('adult', 'photo_ownership')),
      consent_status text NOT NULL DEFAULT 'unknown'
        CHECK (consent_status IN ('unknown', 'granted', 'refused', 'revoked')),
      consent_policy_version text,
      consent_prompted_version text,
      consent_decided_at timestamptz,
      audio_consent boolean,
      audio_consent_prompted boolean NOT NULL DEFAULT false,
      audio_consent_version integer NOT NULL DEFAULT 0 CHECK (audio_consent_version >= 0),
      revocation_pending boolean NOT NULL DEFAULT false
    )`);
    await pool.query(`ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS last_inbound_received_at timestamptz`);
    await pool.query(`UPDATE conversations SET last_inbound_received_at = last_inbound_at
      WHERE last_inbound_received_at IS NULL`);
    await pool.query(`ALTER TABLE conversations
      ALTER COLUMN last_inbound_received_at SET NOT NULL`);
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_open_per_customer
      ON conversations(customer_id) WHERE state = 'open'`);
    await pool.query(`CREATE INDEX IF NOT EXISTS conversations_expiry_idx
      ON conversations(closed_at) WHERE state = 'closed'`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversation_messages (
      message_id uuid PRIMARY KEY,
      conversation_id uuid NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      customer_id uuid NOT NULL REFERENCES conversation_customers(customer_id),
      direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
      kind text NOT NULL CHECK (kind IN ('text', 'audio')),
      source text NOT NULL CHECK (source IN ('whatsapp', 'voice_transcription')),
      text text,
      provider_message_id text UNIQUE,
      reply_to_message_id uuid UNIQUE,
      idempotency_key text NOT NULL UNIQUE,
      delivery_state text NOT NULL CHECK (delivery_state IN ('prepared', 'accepted', 'delivered', 'read', 'failed')),
      occurred_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL,
      CHECK (direction <> 'outbound' OR text IS NOT NULL),
      CHECK (source <> 'voice_transcription' OR (direction = 'inbound' AND kind = 'text' AND text IS NOT NULL))
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS conversation_messages_order_idx
      ON conversation_messages(conversation_id, occurred_at, created_at)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversation_inbound_events (
      provider_event_id text PRIMARY KEY,
      customer_id uuid NOT NULL REFERENCES conversation_customers(customer_id) ON DELETE CASCADE,
      conversation_id uuid NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      inbound_message_id uuid NOT NULL REFERENCES conversation_messages(message_id) ON DELETE CASCADE,
      reply_message_id uuid,
      handoff_id uuid,
      conversation_started_at timestamptz NOT NULL,
      received_at timestamptz NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversation_outbox (
      message_id uuid PRIMARY KEY REFERENCES conversation_messages(message_id) ON DELETE CASCADE,
      conversation_id uuid NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
      status text NOT NULL CHECK (status IN ('pending', 'sending', 'complete', 'blocked', 'failed')),
      block_reason text,
      updated_at timestamptz NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversation_handoffs (
      handoff_id uuid PRIMARY KEY,
      idempotency_key text NOT NULL UNIQUE,
      envelope jsonb NOT NULL,
      created_at timestamptz NOT NULL
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS conversation_delivery_receipts (
      provider_event_id text PRIMARY KEY,
      provider_message_id text NOT NULL,
      state text NOT NULL CHECK (state IN ('accepted', 'failed', 'delivered', 'read')),
      occurred_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await pool.query(`CREATE INDEX IF NOT EXISTS conversation_receipts_message_idx
      ON conversation_delivery_receipts(provider_message_id, occurred_at)`);
    await getBoss().createQueue(CONVERSATION_OUTBOUND_QUEUE, {
      retryLimit: CONVERSATION_OUTBOUND_MAX_RETRIES,
      retryDelay: 1,
      retryBackoff: true,
      retryDelayMax: 30,
      expireInSeconds: 60,
      deleteAfterSeconds: 0,
    });
  })().catch((error: unknown) => { ready = undefined; throw error; });
  return ready;
}

export async function checkConversationRuntimeReadiness(): Promise<boolean> {
  try {
    const readinessQuery = { text: 'SELECT 1 FROM conversation_customers LIMIT 0', query_timeout: 1_500 };
    const query = await getPool().query(readinessQuery);
    return query.rowCount === 0
      && (await getBoss().getQueues([CONVERSATION_OUTBOUND_QUEUE])).length === 1;
  } catch {
    return false;
  }
}

function validTimestamp(value: string): boolean {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function toContext(row: Record<string, unknown>): ConversationContext {
  return {
    customerId: String(row.customer_id),
    conversationId: String(row.conversation_id),
    conversationCreatedAt: new Date(row.conversation_created_at as Date).toISOString(),
    lastInboundAt: new Date(row.last_inbound_at as Date).toISOString(),
    adultConfirmed: row.adult_confirmed === null ? null : Boolean(row.adult_confirmed),
    ownsPhotoConfirmed: row.owns_photo_confirmed === null ? null : Boolean(row.owns_photo_confirmed),
    eligibilityPrompted: row.eligibility_prompted === null
      ? null : row.eligibility_prompted as ConversationContext['eligibilityPrompted'],
    consentStatus: String(row.consent_status) as ConversationContext['consentStatus'],
    consentPolicyVersion: row.consent_policy_version === null ? null : String(row.consent_policy_version),
    consentPromptedVersion: row.consent_prompted_version === null ? null : String(row.consent_prompted_version),
    audioConsent: row.audio_consent === null ? null : Boolean(row.audio_consent),
    audioConsentPrompted: Boolean(row.audio_consent_prompted),
    audioConsentVersion: Number(row.audio_consent_version),
    optedOut: row.opted_out_at !== null,
    revocationPending: Boolean(row.revocation_pending),
  };
}

function assertInbound(input: InboundMessage): void {
  if (!input.providerEventId || input.providerEventId.length > 255
    || !input.providerMessageId || input.providerMessageId.length > 255
    || !input.channelId || input.channelId.length > 100
    || !input.externalCustomerId || input.externalCustomerId.length > 255
    || !validTimestamp(input.occurredAt) || !validTimestamp(input.receivedAt)
    || (input.kind === 'text' && (!input.text?.trim() || input.text.length > 4_000))
    || (input.kind === 'audio' && input.text !== null)
    || !['whatsapp', 'voice_transcription'].includes(input.source)) {
    throw new Error('invalid_conversation_inbound');
  }
}

function idempotencyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function insertDeliveryHandoff(
  client: PoolClient,
  input: {
    messageId: string;
    customerId: string;
    conversationId: string;
    reason: 'send_rules_unknown' | 'outside_service_window' | 'delivery_failure';
    createdAt: string;
  },
): Promise<void> {
  const handoffId = randomUUID();
  const envelope: HandoffContractV1 = {
    version: 'v1',
    handoffId,
    customerId: input.customerId,
    conversationId: input.conversationId,
    kind: 'human_help',
    reason: input.reason,
    safeContext: 'delivery',
    idempotencyKey: `delivery:${input.messageId}`,
    status: 'pending',
    createdAt: input.createdAt,
  };
  if (!isHandoffContractV1(envelope)) throw new Error('invalid_conversation_handoff');
  await client.query(
    `INSERT INTO conversation_handoffs (handoff_id, idempotency_key, envelope, created_at)
     VALUES ($1, $2, $3::jsonb, $4) ON CONFLICT (idempotency_key) DO NOTHING`,
    [handoffId, envelope.idempotencyKey, JSON.stringify(envelope), input.createdAt],
  );
}

async function findInboundResultWith(client: PoolClient, providerEventId: string): Promise<InboundProcessResult | null> {
  const result = await client.query(
    `SELECT e.customer_id, e.conversation_id, e.inbound_message_id, e.reply_message_id,
            e.handoff_id, e.conversation_started_at, reply.text AS reply_text
     FROM conversation_inbound_events e
     LEFT JOIN conversation_messages reply ON reply.message_id = e.reply_message_id
     WHERE e.provider_event_id = $1`,
    [providerEventId],
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    duplicate: true,
    customerId: String(row.customer_id),
    conversationId: String(row.conversation_id),
    inboundMessageId: String(row.inbound_message_id),
    replyMessageId: row.reply_message_id === null ? null : String(row.reply_message_id),
    replyText: row.reply_text === null ? null : String(row.reply_text),
    handoffId: row.handoff_id === null ? null : String(row.handoff_id),
    conversationStartedAt: new Date(row.conversation_started_at as Date).toISOString(),
  };
}

export class PostgresConversationRepository implements ConversationRepository {
  async processInbound(input: InboundMessage, decide: (context: ConversationContext) => ConversationDecision): Promise<InboundProcessResult> {
    assertInbound(input);
    await ensureConversationsReady();
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 0)', [`conversation-event:${input.providerEventId}`]);
      const prior = await findInboundResultWith(client, input.providerEventId);
      if (prior) {
        await client.query('COMMIT');
        return prior;
      }
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 0)', [
        `conversation-customer:${input.channelId}:${input.externalCustomerId}`,
      ]);
      await client.query(
        `INSERT INTO conversation_customers (customer_id, channel_id, external_customer_id, created_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (channel_id, external_customer_id) DO NOTHING`,
        [randomUUID(), input.channelId, input.externalCustomerId, input.receivedAt],
      );
      const customerResult = await client.query(
        `SELECT customer_id, opted_out_at FROM conversation_customers
         WHERE channel_id = $1 AND external_customer_id = $2 FOR UPDATE`,
        [input.channelId, input.externalCustomerId],
      );
      const customer = customerResult.rows[0] as Record<string, unknown> | undefined;
      if (!customer) throw new Error('conversation_customer_missing');
      const customerId = String(customer.customer_id);

      let conversationResult = await client.query(
        `SELECT *, created_at AS conversation_created_at FROM conversations
         WHERE customer_id = $1 AND state = 'open' FOR UPDATE`,
        [customerId],
      );
      let conversation = conversationResult.rows[0] as Record<string, unknown> | undefined;
      const eventAt = new Date(input.occurredAt);
      if (conversation) {
        const priorInboundAt = new Date(conversation.last_inbound_at as Date);
        const priorInboundReceivedAt = new Date(conversation.last_inbound_received_at as Date);
        if (new Date(input.receivedAt).getTime() - priorInboundReceivedAt.getTime() >= IDLE_CLOSE_MS) {
          const closedAt = new Date(priorInboundReceivedAt.getTime() + IDLE_CLOSE_MS).toISOString();
          await client.query(
            `UPDATE conversations SET state = 'closed', closed_at = $2
             WHERE conversation_id = $1 AND state = 'open'`,
            [conversation.conversation_id, closedAt],
          );
          conversation = undefined;
        } else {
          const latest = eventAt.getTime() > priorInboundAt.getTime() ? input.occurredAt : priorInboundAt.toISOString();
          const latestReceived = new Date(input.receivedAt).getTime() > priorInboundReceivedAt.getTime()
            ? input.receivedAt : priorInboundReceivedAt.toISOString();
          await client.query(
            `UPDATE conversations SET last_inbound_at = $2, last_inbound_received_at = $3
             WHERE conversation_id = $1`,
            [conversation.conversation_id, latest, latestReceived],
          );
          conversation.last_inbound_at = new Date(latest);
          conversation.last_inbound_received_at = new Date(latestReceived);
        }
      }
      if (!conversation) {
        const conversationId = randomUUID();
        await client.query(
          `INSERT INTO conversations (
             conversation_id, customer_id, state, created_at, last_inbound_at, last_inbound_received_at
           ) VALUES ($1, $2, 'open', $3, $4, $5)`,
          [conversationId, customerId, input.receivedAt, input.occurredAt, input.receivedAt],
        );
        conversationResult = await client.query(
          `SELECT *, created_at AS conversation_created_at FROM conversations WHERE conversation_id = $1 FOR UPDATE`,
          [conversationId],
        );
        conversation = conversationResult.rows[0] as Record<string, unknown>;
      }
      if (!conversation) throw new Error('conversation_not_open');

      const context = toContext({
        ...conversation,
        customer_id: customerId,
        opted_out_at: customer.opted_out_at,
      });
      const transcriptAuthorized = input.source !== 'voice_transcription'
        || (context.audioConsent === true
          && context.audioConsentVersion === input.expectedAudioConsentVersion
          && !context.revocationPending
          && context.consentStatus !== 'revoked');
      const decision = decide(context);
      const inboundMessageId = randomUUID();
      const storedKind = transcriptAuthorized ? input.kind : 'audio';
      const storedText = transcriptAuthorized ? input.text : null;
      const storedSource = transcriptAuthorized ? input.source : 'whatsapp';
      await client.query(
        `INSERT INTO conversation_messages (
           message_id, conversation_id, customer_id, direction, kind, source, text,
           provider_message_id, reply_to_message_id, idempotency_key, delivery_state, occurred_at, created_at
         ) VALUES ($1, $2, $3, 'inbound', $4, $5, $6, $7, NULL, $8, 'accepted', $9, $10)`,
        [
          inboundMessageId, context.conversationId, customerId, storedKind, storedSource, storedText,
          input.providerMessageId, `inbound:${idempotencyHash(input.providerEventId)}`,
          input.occurredAt, input.receivedAt,
        ],
      );

      const customerPatch = decision.customerPatch ?? {};
      if (customerPatch.optedOut === true) {
        await client.query(
          'UPDATE conversation_customers SET opted_out_at = $2 WHERE customer_id = $1',
          [customerId, input.receivedAt],
        );
      }
      const conversationPatch = decision.conversationPatch ?? {};
      const fields: Array<[string, string, unknown]> = [
        ['eligibilityPrompted', 'eligibility_prompted', conversationPatch.eligibilityPrompted],
        ['consentPromptedVersion', 'consent_prompted_version', conversationPatch.consentPromptedVersion],
        ['audioConsent', 'audio_consent', conversationPatch.audioConsent],
        ['audioConsentPrompted', 'audio_consent_prompted', conversationPatch.audioConsentPrompted],
      ];
      const setClauses: string[] = [];
      const values: unknown[] = [context.conversationId];
      for (const [, column, value] of fields) {
        if (value === undefined) continue;
        values.push(value);
        setClauses.push(`${column} = $${values.length}`);
      }
      const conversationColumns: Array<[string, string, unknown]> = [
        ['adultConfirmed', 'adult_confirmed', customerPatch.adultConfirmed],
        ['ownsPhotoConfirmed', 'owns_photo_confirmed', customerPatch.ownsPhotoConfirmed],
        ['consentStatus', 'consent_status', customerPatch.consentStatus],
        ['consentPolicyVersion', 'consent_policy_version', customerPatch.consentPolicyVersion],
        ['consentAt', 'consent_decided_at', customerPatch.consentAt],
        ['revocationPending', 'revocation_pending', customerPatch.revocationPending],
      ];
      for (const [, column, value] of conversationColumns) {
        if (value === undefined) continue;
        values.push(value);
        setClauses.push(`${column} = $${values.length}`);
      }
      if (conversationPatch.incrementAudioConsentVersion) setClauses.push('audio_consent_version = audio_consent_version + 1');
      if (setClauses.length) {
        await client.query(`UPDATE conversations SET ${setClauses.join(', ')} WHERE conversation_id = $1`, values);
      }

      let handoffId: string | null = null;
      if (decision.handoff) {
        handoffId = randomUUID();
        const envelope: HandoffContractV1 = {
          version: 'v1',
          handoffId,
          customerId,
          conversationId: context.conversationId,
          ...decision.handoff,
          idempotencyKey: `handoff:${decision.handoff.kind}:${idempotencyHash(input.providerEventId)}`,
          status: 'pending',
          createdAt: input.receivedAt,
        };
        if (!isHandoffContractV1(envelope)) throw new Error('invalid_conversation_handoff');
        const handoff = await client.query(
          `INSERT INTO conversation_handoffs (handoff_id, idempotency_key, envelope, created_at)
           VALUES ($1, $2, $3::jsonb, $4)
           ON CONFLICT (idempotency_key) DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
           RETURNING handoff_id`,
          [handoffId, envelope.idempotencyKey, JSON.stringify(envelope), input.receivedAt],
        );
        handoffId = String(handoff.rows[0].handoff_id);
      }

      let replyMessageId: string | null = null;
      const replyText = decision.replyText?.trim() || null;
      if (replyText && !context.optedOut && customerPatch.optedOut !== true) {
        replyMessageId = randomUUID();
        await client.query(
          `INSERT INTO conversation_messages (
             message_id, conversation_id, customer_id, direction, kind, source, text,
             provider_message_id, reply_to_message_id, idempotency_key, delivery_state, occurred_at, created_at
           ) VALUES ($1, $2, $3, 'outbound', 'text', 'whatsapp', $4, NULL, $5, $6, 'prepared', $7, $7)`,
          [
            replyMessageId, context.conversationId, customerId, replyText, inboundMessageId,
            `reply:${idempotencyHash(input.providerEventId)}`, input.receivedAt,
          ],
        );
        await client.query(
          `INSERT INTO conversation_outbox (message_id, conversation_id, status, updated_at)
           VALUES ($1, $2, 'pending', $3)`,
          [replyMessageId, context.conversationId, input.receivedAt],
        );
        const queued = await getBoss().send(CONVERSATION_OUTBOUND_QUEUE, {
          kind: 'conversation-outbound', messageId: replyMessageId,
        }, {
          id: replyMessageId,
          retryLimit: CONVERSATION_OUTBOUND_MAX_RETRIES,
          retryDelay: 1,
          retryBackoff: true,
          retryDelayMax: 30,
          expireInSeconds: 60,
          deleteAfterSeconds: 0,
          db: transactionDb(client),
        });
        if (!queued) throw new Error('conversation_outbox_enqueue_failed');
      }

      await client.query(
        `INSERT INTO conversation_inbound_events (
           provider_event_id, customer_id, conversation_id, inbound_message_id,
           reply_message_id, handoff_id, conversation_started_at, received_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          input.providerEventId, customerId, context.conversationId, inboundMessageId,
          replyMessageId, handoffId, context.conversationCreatedAt, input.receivedAt,
        ],
      );
      await client.query('COMMIT');
      return {
        duplicate: false,
        customerId,
        conversationId: context.conversationId,
        inboundMessageId,
        replyMessageId,
        replyText: replyMessageId ? replyText : null,
        handoffId,
        conversationStartedAt: context.conversationCreatedAt,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findInboundResult(providerEventId: string): Promise<InboundProcessResult | null> {
    await ensureConversationsReady();
    const client = await getPool().connect();
    try { return await findInboundResultWith(client, providerEventId); }
    finally { client.release(); }
  }

  async getVoiceAuthorization(channelId: string, externalCustomerId: string, receivedAt?: string): Promise<VoiceAuthorization> {
    const result = await this.withVoiceAuthorization(
      channelId, externalCustomerId, async (authorization) => authorization, receivedAt,
    );
    return result.authorization;
  }

  async withVoiceAuthorization<T>(
    channelId: string,
    externalCustomerId: string,
    action: (authorization: VoiceAuthorization) => Promise<T>,
    receivedAt?: string,
  ): Promise<import('../../modules/conversations/repository').VoiceAuthorizationRun<T>> {
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1), 0)', [
        `conversation-customer:${channelId}:${externalCustomerId}`,
      ]);
      const customerResult = await client.query(
        `SELECT customer_id, opted_out_at FROM conversation_customers
         WHERE channel_id = $1 AND external_customer_id = $2 FOR UPDATE`,
        [channelId, externalCustomerId],
      );
      const customer = customerResult.rows[0] as Record<string, unknown> | undefined;
      const emptyAuthorization: VoiceAuthorization = {
        allowed: false, conversationId: null, consentVersion: null, externalCustomerId,
      };
      let authorization = emptyAuthorization;
      if (customer) {
        const conversationResult = await client.query(
          `SELECT conversation_id, audio_consent, audio_consent_version, last_inbound_received_at,
                  revocation_pending, consent_status
           FROM conversations
           WHERE customer_id = $1 AND state = 'open'
           ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
          [customer.customer_id],
        );
        const conversation = conversationResult.rows[0] as Record<string, unknown> | undefined;
        const lifecycleActive = receivedAt === undefined || (validTimestamp(receivedAt)
          && new Date(receivedAt).getTime() - new Date(conversation?.last_inbound_received_at as Date).getTime() < IDLE_CLOSE_MS);
        const allowed = lifecycleActive && customer.opted_out_at === null
          && conversation?.audio_consent === true
          && conversation.revocation_pending !== true
          && conversation.consent_status !== 'revoked';
        authorization = {
          allowed,
          conversationId: conversation?.conversation_id ? String(conversation.conversation_id) : null,
          consentVersion: allowed ? Number(conversation?.audio_consent_version) : null,
          externalCustomerId,
        };
      }
      if (!authorization.allowed) {
        await client.query('COMMIT');
        return { authorized: false, authorization };
      }
      const result = await action(authorization);
      await client.query('COMMIT');
      return { authorized: true, authorization, result };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async withCustomerSendLock<T>(messageId: string, action: () => Promise<T>): Promise<T> {
    await ensureConversationsReady();
    const client = await getPool().connect();
    let lockKey: string | null = null;
    let releaseError: Error | undefined;
    try {
      const message = await client.query(
        `SELECT c.channel_id, c.external_customer_id
         FROM conversation_outbox o
         JOIN conversation_messages m ON m.message_id = o.message_id
         JOIN conversation_customers c ON c.customer_id = m.customer_id
         WHERE o.message_id = $1`,
        [messageId],
      );
      const customer = message.rows[0] as Record<string, unknown> | undefined;
      if (!customer) return await action();

      lockKey = `conversation-customer:${String(customer.channel_id)}:${String(customer.external_customer_id)}`;
      await client.query('SELECT pg_advisory_lock(hashtext($1), 0)', [lockKey]);
      return await action();
    } finally {
      if (lockKey !== null) {
        try {
          const unlocked = await client.query('SELECT pg_advisory_unlock(hashtext($1), 0) AS unlocked', [lockKey]);
          if (unlocked.rows[0]?.unlocked !== true) releaseError = new Error('conversation_send_lock_release_failed');
        } catch (error) {
          releaseError = error instanceof Error ? error : new Error('conversation_send_lock_release_failed');
        }
      }
      client.release(releaseError);
    }
  }

  async claimOutbound(messageId: string, now: string, sendRulesVerified: boolean): Promise<DeliveryClaim> {
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query(
        `SELECT o.status AS outbox_status, m.message_id, m.customer_id, m.conversation_id, m.text,
                m.delivery_state, m.provider_message_id, c.external_customer_id, c.opted_out_at,
                c.channel_id, v.last_inbound_at, v.revocation_pending, v.consent_status
         FROM conversation_outbox o
         JOIN conversation_messages m ON m.message_id = o.message_id
         JOIN conversation_customers c ON c.customer_id = m.customer_id
         JOIN conversations v ON v.conversation_id = m.conversation_id
         WHERE o.message_id = $1 FOR UPDATE OF o, m, c, v`,
        [messageId],
      );
      const row = selected.rows[0] as Record<string, unknown> | undefined;
      if (!row) { await client.query('COMMIT'); return { status: 'not_found' }; }
      if (row.outbox_status === 'sending') {
        await client.query(
          `UPDATE conversation_outbox SET status = 'blocked', block_reason = 'delivery_outcome_unknown', updated_at = $2
           WHERE message_id = $1 AND status = 'sending'`, [messageId, now],
        );
        await insertDeliveryHandoff(client, {
          messageId,
          customerId: String(row.customer_id),
          conversationId: String(row.conversation_id),
          reason: 'delivery_failure',
          createdAt: now,
        });
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'already_handled' };
      }
      if (row.outbox_status !== 'pending') {
        await client.query('COMMIT');
        return { status: 'blocked', reason: 'already_handled' };
      }
      const optedOut = row.opted_out_at !== null;
      const revoked = Boolean(row.revocation_pending) || row.consent_status === 'revoked';
      const reason = optedOut ? 'opted_out'
        : revoked ? 'revoked'
          : !sendRulesVerified ? 'send_rules_unknown'
          : new Date(now).getTime() - new Date(row.last_inbound_at as Date).getTime() >= IDLE_CLOSE_MS
            ? 'outside_service_window' : null;
      if (reason) {
        await client.query(
          `UPDATE conversation_outbox SET status = 'blocked', block_reason = $2, updated_at = $3
           WHERE message_id = $1 AND status = 'pending'`, [messageId, reason, now],
        );
        if (reason === 'send_rules_unknown' || reason === 'outside_service_window') {
          await insertDeliveryHandoff(client, {
            messageId,
            customerId: String(row.customer_id),
            conversationId: String(row.conversation_id),
            reason,
            createdAt: now,
          });
        }
        await client.query('COMMIT');
        return { status: 'blocked', reason };
      }
      await client.query(
        `UPDATE conversation_outbox SET status = 'sending', updated_at = $2
         WHERE message_id = $1 AND status = 'pending'`, [messageId, now],
      );
      await client.query('COMMIT');
      return {
        status: 'claimed',
        message: {
          messageId: String(row.message_id),
          customerId: String(row.customer_id),
          conversationId: String(row.conversation_id),
          channelId: String(row.channel_id),
          externalCustomerId: String(row.external_customer_id),
          text: String(row.text),
          lastInboundAt: new Date(row.last_inbound_at as Date).toISOString(),
          optedOut,
          revocationPending: Boolean(row.revocation_pending),
          deliveryState: String(row.delivery_state) as ConversationDeliveryState,
          providerMessageId: row.provider_message_id === null ? null : String(row.provider_message_id),
        },
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async markOutboundAccepted(messageId: string, providerMessageId: string, acceptedAt: string): Promise<void> {
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const current = await client.query(
        `SELECT delivery_state FROM conversation_messages WHERE message_id = $1 FOR UPDATE`, [messageId],
      );
      if (!current.rows[0]) throw new Error('conversation_message_missing');
      const currentState = String(current.rows[0].delivery_state) as ConversationDeliveryState;
      if (DELIVERY_RANK.accepted > DELIVERY_RANK[currentState]) {
        await client.query(
          `UPDATE conversation_messages SET delivery_state = 'accepted', provider_message_id = $2
           WHERE message_id = $1`, [messageId, providerMessageId],
        );
      } else {
        await client.query(
          `UPDATE conversation_messages SET provider_message_id = $2 WHERE message_id = $1`,
          [messageId, providerMessageId],
        );
      }
      await client.query(
        `UPDATE conversation_outbox SET status = 'complete', block_reason = NULL, updated_at = $2
         WHERE message_id = $1`, [messageId, acceptedAt],
      );
      const early = await client.query(
        `SELECT state FROM conversation_delivery_receipts WHERE provider_message_id = $1`, [providerMessageId],
      );
      const best = (early.rows as Array<Record<string, unknown>>)
        .map((row) => String(row.state) as ConversationDeliveryState)
        .sort((a, b) => DELIVERY_RANK[b] - DELIVERY_RANK[a])[0];
      if (best && DELIVERY_RANK[best] > DELIVERY_RANK[currentState]) {
        await client.query('UPDATE conversation_messages SET delivery_state = $2 WHERE message_id = $1', [messageId, best]);
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async markOutboundBlocked(messageId: string, reason: string): Promise<void> {
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query(
        `SELECT o.status, m.customer_id, m.conversation_id
         FROM conversation_outbox o JOIN conversation_messages m ON m.message_id = o.message_id
         WHERE o.message_id = $1 FOR UPDATE OF o, m`, [messageId],
      );
      const row = selected.rows[0] as Record<string, unknown> | undefined;
      if (row && ['pending', 'sending'].includes(String(row.status))) {
        const blockedAt = new Date().toISOString();
        await client.query(
          `UPDATE conversation_outbox SET status = 'blocked', block_reason = $2, updated_at = $3
           WHERE message_id = $1 AND status IN ('pending', 'sending')`,
          [messageId, reason.slice(0, 80), blockedAt],
        );
        await insertDeliveryHandoff(client, {
          messageId,
          customerId: String(row.customer_id),
          conversationId: String(row.conversation_id),
          reason: 'delivery_failure',
          createdAt: blockedAt,
        });
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async markOutboundRetryable(messageId: string, reason: string): Promise<void> {
    await ensureConversationsReady();
    await getPool().query(
      `UPDATE conversation_outbox SET status = 'pending', block_reason = $2, updated_at = now()
       WHERE message_id = $1 AND status = 'sending'`, [messageId, `retry:${reason}`.slice(0, 80)],
    );
  }

  async markOutboundFailed(messageId: string, reason: string, failedAt: string): Promise<void> {
    if (!validTimestamp(failedAt)) throw new Error('invalid_conversation_failure_time');
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const selected = await client.query(
        `SELECT o.status, m.customer_id, m.conversation_id, m.delivery_state
         FROM conversation_outbox o JOIN conversation_messages m ON m.message_id = o.message_id
         WHERE o.message_id = $1 FOR UPDATE OF o, m`, [messageId],
      );
      const row = selected.rows[0] as Record<string, unknown> | undefined;
      if (row && ['pending', 'sending'].includes(String(row.status))) {
        await client.query(
          `UPDATE conversation_outbox SET status = 'failed', block_reason = $2, updated_at = $3
           WHERE message_id = $1`, [messageId, reason.slice(0, 80), failedAt],
        );
        const currentDeliveryState = String(row.delivery_state) as ConversationDeliveryState;
        if (DELIVERY_RANK.failed > DELIVERY_RANK[currentDeliveryState]) {
          await client.query(
            `UPDATE conversation_messages SET delivery_state = 'failed' WHERE message_id = $1`, [messageId],
          );
        }
        await insertDeliveryHandoff(client, {
          messageId,
          customerId: String(row.customer_id),
          conversationId: String(row.conversation_id),
          reason: 'delivery_failure',
          createdAt: failedAt,
        });
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async recordDeliveryReceipt(receipt: DeliveryReceipt): Promise<ConversationDeliveryState | null> {
    if (!receipt.providerEventId || !receipt.providerMessageId || !validTimestamp(receipt.occurredAt)) {
      throw new Error('invalid_conversation_delivery_receipt');
    }
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO conversation_delivery_receipts (provider_event_id, provider_message_id, state, occurred_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (provider_event_id) DO NOTHING`,
        [receipt.providerEventId, receipt.providerMessageId, receipt.state, receipt.occurredAt],
      );
      const messageResult = await client.query(
        `SELECT message_id, delivery_state FROM conversation_messages
         WHERE provider_message_id = $1 FOR UPDATE`, [receipt.providerMessageId],
      );
      const row = messageResult.rows[0] as Record<string, unknown> | undefined;
      if (!row) { await client.query('COMMIT'); return null; }
      const current = String(row.delivery_state) as ConversationDeliveryState;
      const all = await client.query(
        `SELECT state FROM conversation_delivery_receipts WHERE provider_message_id = $1`, [receipt.providerMessageId],
      );
      const best = (all.rows as Array<Record<string, unknown>>)
        .map((item) => String(item.state) as ConversationDeliveryState)
        .sort((a, b) => DELIVERY_RANK[b] - DELIVERY_RANK[a])[0] ?? current;
      const next = DELIVERY_RANK[best] > DELIVERY_RANK[current] ? best : current;
      if (next !== current) {
        await client.query('UPDATE conversation_messages SET delivery_state = $2 WHERE message_id = $1', [row.message_id, next]);
      }
      await client.query('COMMIT');
      return next;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async purgeExpired(now: string): Promise<number> {
    if (!validTimestamp(now)) throw new Error('invalid_conversation_expiry_time');
    await ensureConversationsReady();
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `UPDATE conversations SET state = 'closed', closed_at = last_inbound_received_at + interval '24 hours'
         WHERE state = 'open' AND last_inbound_received_at <= $1::timestamptz - interval '24 hours'`, [now],
      );
      await client.query(
        `DELETE FROM conversation_handoffs h
         WHERE h.envelope->>'conversationId' IN (
           SELECT conversation_id::text FROM conversations
           WHERE state = 'closed' AND closed_at <= $1::timestamptz - interval '7 days'
         )`, [now],
      );
      const result = await client.query(
        `DELETE FROM conversations WHERE state = 'closed' AND closed_at <= $1::timestamptz - interval '7 days'`, [now],
      );
      await client.query(
        `DELETE FROM conversation_customers c
         WHERE NOT EXISTS (
           SELECT 1 FROM conversations v WHERE v.customer_id = c.customer_id
         )`,
      );
      await client.query(
        `DELETE FROM conversation_delivery_receipts WHERE occurred_at <= $1::timestamptz - interval '7 days'`, [now],
      );
      await client.query('COMMIT');
      return result.rowCount ?? 0;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
