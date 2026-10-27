import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { DATA_POLICY_V1 } = require('../dist/modules/data-policy/policy-v1.js');
const { DATA_POLICY_V2 } = require('../dist/modules/data-policy/policy-v2.js');
const { decideDataUse, readApprovedDataPolicy } = require('../dist/modules/data-policy/use-cases.js');
const { isDataPolicyV1 } = require('../dist/contracts/data-policy/v1.js');
const { isDataPolicyV2 } = require('../dist/contracts/data-policy/v2.js');

test('approved v2 snapshot is immutable, repeatable, and readable while real-data use stays closed', () => {
  const first = readApprovedDataPolicy();
  const second = readApprovedDataPolicy();

  assert.equal(first.status, 'available');
  assert.equal(second.status, 'available');
  assert.equal(first.policy.version, 'v2');
  assert.equal(first.summary, DATA_POLICY_V2.summary);
  assert.deepEqual(first.policy, DATA_POLICY_V2);
  assert.strictEqual(first.policy, second.policy);
  assert.ok(Object.isFrozen(first.policy));
  assert.ok(Object.isFrozen(first.policy.providers));
  assert.ok(Object.isFrozen(first.policy.dataSets[0].retention));
  assert.equal(isDataPolicyV2(first.policy), true);
  assert.deepEqual(decideDataUse(first.policy, 'process'), {
    allowed: false,
    action: 'process',
    reason: 'local_deletion_unverified',
  });
});

test('missing and incomplete policy block collection and processing with stable reasons', () => {
  assert.deepEqual(readApprovedDataPolicy(null), { status: 'blocked', reason: 'policy_missing' });
  assert.deepEqual(decideDataUse(null, 'collect'), {
    allowed: false, action: 'collect', reason: 'policy_missing',
  });

  const missingDataSet = {
    ...DATA_POLICY_V2,
    dataSets: DATA_POLICY_V2.dataSets.filter((dataSet) => dataSet.id !== 'conversation_and_consent'),
  };
  const missingRequiredField = { ...DATA_POLICY_V2, summary: '' };
  assert.equal(isDataPolicyV2(missingDataSet), false);
  assert.equal(isDataPolicyV2(missingRequiredField), false);
  assert.deepEqual(readApprovedDataPolicy(missingDataSet), {
    status: 'blocked', reason: 'policy_incomplete',
  });
  assert.deepEqual(decideDataUse(missingRequiredField, 'process'), {
    allowed: false, action: 'process', reason: 'policy_incomplete',
  });
});

test('a structurally valid policy without owner approval blocks use', () => {
  const unapproved = structuredClone(DATA_POLICY_V2);
  unapproved.ownerApproval = {
    status: 'not_approved',
    decidedAt: '2026-10-27',
    approvedAt: null,
  };

  assert.equal(isDataPolicyV2(unapproved), true);
  assert.deepEqual(readApprovedDataPolicy(unapproved), {
    status: 'blocked', reason: 'policy_not_approved',
  });
  assert.deepEqual(decideDataUse(unapproved, 'collect'), {
    allowed: false, action: 'collect', reason: 'policy_not_approved',
  });
});

test('pending local deletion is the only Data Policy readiness gate and makes no provider calls', () => {
  const read = readApprovedDataPolicy();
  assert.equal(read.status, 'available');
  assert.deepEqual(read.policy.operationalReadiness, { localDeletion: 'pending' });
  assert.equal(Object.hasOwn(read.policy.providers[0], 'region'), true);
  assert.equal(read.policy.providers.find((provider) => provider.id === 'meta_whatsapp_cloud_api_direct')?.selected, true);

  let providerCalls = 0;
  for (const action of ['collect', 'process']) {
    const decision = decideDataUse(read.policy, action);
    assert.deepEqual(decision, {
      allowed: false, action, reason: 'local_deletion_unverified',
    });
    assert.equal(providerCalls, 0);
  }

  const useCasesSource = readFileSync(new URL('../src/modules/data-policy/use-cases.ts', import.meta.url), 'utf8');
  const policySource = readFileSync(new URL('../src/modules/data-policy/policy-v2.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(`${useCasesSource}\n${policySource}`, /\b(fetch|axios|googleapis|@google\/|@meta\/|abacatepay)\s*\(/i);
});

test('v1 remains valid history but cannot replace the current v2 artifact', () => {
  assert.equal(DATA_POLICY_V1.version, 'v1');
  assert.equal(isDataPolicyV1(DATA_POLICY_V1), true);
  assert.deepEqual(readApprovedDataPolicy(DATA_POLICY_V1), {
    status: 'blocked', reason: 'policy_not_current',
  });
  assert.deepEqual(decideDataUse(DATA_POLICY_V1, 'process'), {
    allowed: false, action: 'process', reason: 'policy_not_current',
  });
});

test('an injected verified snapshot cannot replace the immutable owner-approved v2 artifact', () => {
  const injected = structuredClone(DATA_POLICY_V2);
  injected.operationalReadiness = {
    localDeletion: 'verified',
  };

  assert.equal(isDataPolicyV2(injected), true);
  assert.deepEqual(decideDataUse(injected, 'process'), {
    allowed: false, action: 'process', reason: 'policy_not_current',
  });
});

test('v2 retention covers app-controlled PostgreSQL and Bucket data and separates backup/provider copies', () => {
  const byId = Object.fromEntries(DATA_POLICY_V2.dataSets.map((dataSet) => [dataSet.id, dataSet]));

  assert.equal(byId.conversation_and_consent.storage, 'private_postgresql');
  assert.equal(byId.conversation_and_consent.retention.applicationDays, 7);
  assert.match(byId.conversation_and_consent.retention.applicationStartsAt, /encerramento da conversa/i);
  assert.match(byId.conversation_and_consent.retention.externalProviderCopies, /Meta e Google/i);
  assert.equal(byId.conversation_and_consent.retention.backupDays, 6);
  assert.match(byId.conversation_and_consent.retention.backupCadence, /pg_dump a cada 3 dias/i);

  assert.equal(byId.source_image.storage, 'private_bucket');
  assert.equal(byId.source_image.retention.applicationDays, 7);
  assert.match(byId.source_image.retention.applicationStartsAt, /entrega do resultado/i);
  assert.equal(byId.source_image.retention.backupDays, null);
  assert.equal(byId.generated_result.storage, 'private_bucket');
  assert.equal(byId.generated_result.retention.applicationDays, 7);
  assert.match(byId.generated_result.retention.applicationStartsAt, /entrega do resultado/i);
  assert.equal(byId.generated_result.retention.backupDays, null);

  assert.match(byId.conversation_and_consent.deletion.backupCopies, /expiram pela configuração atual de 6 dias/i);
  assert.match(byId.source_image.deletion.activeCopies, /implementada e comprovada/i);
  assert.match(DATA_POLICY_V2.providers.find((provider) => provider.id === 'abacatepay_pix').externalCopies,
    /lei ou regulação/i);
});

test('the v1 and v2 validators reject omitted, malformed, and unknown fields without defaults', () => {
  assert.equal(isDataPolicyV1(DATA_POLICY_V1), true);
  assert.equal(isDataPolicyV1({ ...DATA_POLICY_V1, unreviewedDefault: true }), false);

  const invalidTransfer = structuredClone(DATA_POLICY_V1);
  invalidTransfer.dataSets[0].transfer.destinations = [];
  assert.equal(isDataPolicyV1(invalidTransfer), false);

  const invalidDate = structuredClone(DATA_POLICY_V1);
  invalidDate.effectiveDate = '2026-02-30';
  assert.equal(isDataPolicyV1(invalidDate), false);

  assert.equal(isDataPolicyV2(DATA_POLICY_V2), true);
  assert.equal(isDataPolicyV2(undefined), false);
  assert.equal(isDataPolicyV2({ ...DATA_POLICY_V2, unreviewedDefault: true }), false);

  const regionAsReadinessCheck = structuredClone(DATA_POLICY_V2);
  regionAsReadinessCheck.operationalReadiness.region = 'pending';
  assert.equal(isDataPolicyV2(regionAsReadinessCheck), false);

  const missingDeletionGate = structuredClone(DATA_POLICY_V2);
  missingDeletionGate.operationalReadiness = {};
  assert.equal(isDataPolicyV2(missingDeletionGate), false);

  const invalidDateV2 = structuredClone(DATA_POLICY_V2);
  invalidDateV2.effectiveDate = '2026-02-30';
  assert.equal(isDataPolicyV2(invalidDateV2), false);
});
