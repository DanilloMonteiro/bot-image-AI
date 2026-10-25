import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { DATA_POLICY_V1 } = require('../dist/modules/data-policy/policy-v1.js');
const { decideDataUse, readApprovedDataPolicy } = require('../dist/modules/data-policy/use-cases.js');
const { isDataPolicyV1 } = require('../dist/contracts/data-policy/v1.js');

test('approved v1 snapshot is immutable, repeatable, and readable while real-data use stays closed', () => {
  const first = readApprovedDataPolicy();
  const second = readApprovedDataPolicy();

  assert.equal(first.status, 'available');
  assert.equal(second.status, 'available');
  assert.equal(first.policy.version, 'v1');
  assert.equal(first.summary, DATA_POLICY_V1.summary);
  assert.deepEqual(first.policy, DATA_POLICY_V1);
  assert.strictEqual(first.policy, second.policy);
  assert.ok(Object.isFrozen(first.policy));
  assert.ok(Object.isFrozen(first.policy.providers));
  assert.ok(Object.isFrozen(first.policy.dataSets[0].retention));
  assert.deepEqual(decideDataUse(first.policy, 'process'), {
    allowed: false,
    action: 'process',
    reason: 'operational_validation_pending',
  });
});

test('missing and incomplete policy block collection and processing with stable reasons', () => {
  assert.deepEqual(readApprovedDataPolicy(null), { status: 'blocked', reason: 'policy_missing' });
  assert.deepEqual(decideDataUse(null, 'collect'), {
    allowed: false, action: 'collect', reason: 'policy_missing',
  });

  const missingDataSet = {
    ...DATA_POLICY_V1,
    dataSets: DATA_POLICY_V1.dataSets.filter((dataSet) => dataSet.id !== 'consent_evidence'),
  };
  const missingRequiredField = { ...DATA_POLICY_V1, summary: '' };
  assert.equal(isDataPolicyV1(missingDataSet), false);
  assert.equal(isDataPolicyV1(missingRequiredField), false);
  assert.deepEqual(readApprovedDataPolicy(missingDataSet), {
    status: 'blocked', reason: 'policy_incomplete',
  });
  assert.deepEqual(decideDataUse(missingRequiredField, 'process'), {
    allowed: false, action: 'process', reason: 'policy_incomplete',
  });
});

test('a structurally valid policy without owner approval blocks use', () => {
  const unapproved = structuredClone(DATA_POLICY_V1);
  unapproved.ownerApproval = {
    status: 'not_approved',
    decidedAt: '2026-10-25',
    approvedAt: null,
  };

  assert.equal(isDataPolicyV1(unapproved), true);
  assert.deepEqual(readApprovedDataPolicy(unapproved), {
    status: 'blocked', reason: 'policy_not_approved',
  });
  assert.deepEqual(decideDataUse(unapproved, 'collect'), {
    allowed: false, action: 'collect', reason: 'policy_not_approved',
  });
});

test('pending transfer, encryption, and deletion checks block real-data actions without provider calls', () => {
  const read = readApprovedDataPolicy();
  assert.equal(read.status, 'available');
  assert.deepEqual(read.policy.operationalReadiness, {
    international_transfer: 'pending',
    encryption: 'pending',
    verifiable_deletion: 'pending',
  });

  let providerCalls = 0;
  for (const action of ['collect', 'process']) {
    const decision = decideDataUse(read.policy, action);
    assert.deepEqual(decision, {
      allowed: false, action, reason: 'operational_validation_pending',
    });
    assert.equal(providerCalls, 0);
  }

  const useCasesSource = readFileSync(new URL('../src/modules/data-policy/use-cases.ts', import.meta.url), 'utf8');
  const policySource = readFileSync(new URL('../src/modules/data-policy/policy-v1.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(`${useCasesSource}\n${policySource}`, /\b(fetch|axios|googleapis|@google\/|@meta\/|abacatepay)\s*\(/i);
});

test('an injected verified snapshot cannot replace the immutable owner-approved artifact', () => {
  const injected = structuredClone(DATA_POLICY_V1);
  injected.operationalReadiness = {
    international_transfer: 'verified',
    encryption: 'verified',
    verifiable_deletion: 'verified',
  };

  assert.equal(isDataPolicyV1(injected), true);
  assert.deepEqual(decideDataUse(injected, 'process'), {
    allowed: false, action: 'process', reason: 'policy_not_current',
  });
});

test('retention distinguishes active copies, provider copies, legal payment records, and Railway dumps', () => {
  const byId = Object.fromEntries(DATA_POLICY_V1.dataSets.map((dataSet) => [dataSet.id, dataSet]));

  assert.equal(byId.whatsapp_conversation.retention.applicationDays, 7);
  assert.match(byId.whatsapp_conversation.retention.applicationStartsAt, /encerramento da conversa/i);
  assert.match(byId.whatsapp_conversation.retention.providerCopies, /Meta\/Google\/BSP/i);
  assert.equal(byId.whatsapp_conversation.retention.backupDays, 6);
  assert.match(byId.whatsapp_conversation.retention.backupStartsAt, /cada 3 dias/i);

  assert.equal(byId.consent_evidence.retention.applicationDays, 7);
  assert.match(byId.consent_evidence.retention.applicationStartsAt, /encerramento da conversa/i);
  assert.equal(byId.consent_evidence.retention.backupDays, 6);
  assert.equal(byId.source_image.retention.applicationDays, 7);
  assert.match(byId.source_image.retention.applicationStartsAt, /entrega do resultado/i);
  assert.equal(byId.source_image.retention.backupDays, null);
  assert.equal(byId.generated_result.retention.applicationDays, 7);
  assert.match(byId.generated_result.retention.applicationStartsAt, /entrega do resultado/i);
  assert.equal(byId.generated_result.retention.backupDays, null);

  assert.equal(byId.payment_records.retention.applicationDays, null);
  assert.equal(byId.payment_records.retention.backupDays, null);
  assert.match(byId.payment_records.retention.providerCopies, /legais\/regulatórios/i);
  assert.match(byId.payment_records.exceptions.join(' '), /AbacatePay/i);

  assert.equal(byId.railway_backup_copy.retention.applicationDays, null);
  assert.equal(byId.railway_backup_copy.retention.backupDays, 6);
  assert.match(byId.railway_backup_copy.retention.backupStartsAt, /cada dump pg_dump, executado a cada 3 dias/i);
  assert.match(byId.railway_backup_copy.deletion.backupCopies, /expiram pelo ciclo de retenção de 6 dias/i);
});

test('the v1 validator rejects omitted, malformed, and unknown fields without defaults', () => {
  assert.equal(isDataPolicyV1(DATA_POLICY_V1), true);
  assert.equal(isDataPolicyV1(undefined), false);
  assert.equal(isDataPolicyV1({ ...DATA_POLICY_V1, unreviewedDefault: true }), false);

  const invalidTransfer = structuredClone(DATA_POLICY_V1);
  invalidTransfer.dataSets[0].transfer.destinations = [];
  assert.equal(isDataPolicyV1(invalidTransfer), false);

  const invalidDate = structuredClone(DATA_POLICY_V1);
  invalidDate.effectiveDate = '2026-02-30';
  assert.equal(isDataPolicyV1(invalidDate), false);
});
