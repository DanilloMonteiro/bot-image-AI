import {
  DATA_POLICY_OPERATIONAL_CHECKS_V1,
  isDataPolicyV1,
  type DataPolicyV1,
} from '../../contracts/data-policy/v1.js';
import { deepFreeze } from './deep-freeze.js';
import { DATA_POLICY_V1 } from './policy-v1.js';

export type DataPolicyBlockReasonV1 =
  | 'policy_missing'
  | 'policy_incomplete'
  | 'policy_not_approved'
  | 'policy_not_current'
  | 'operational_validation_pending';

export type DataPolicyReadResultV1 =
  | { status: 'available'; policy: DataPolicyV1; summary: string }
  | {
    status: 'blocked';
    reason: Exclude<DataPolicyBlockReasonV1, 'operational_validation_pending' | 'policy_not_current'>;
  };

export type DataUseActionV1 = 'collect' | 'process';

export type DataUseDecisionV1 =
  | { allowed: true; action: DataUseActionV1; version: DataPolicyV1['version'] }
  | { allowed: false; action: DataUseActionV1; reason: DataPolicyBlockReasonV1 };

function immutableSnapshot(snapshot: DataPolicyV1): DataPolicyV1 {
  if (snapshot === DATA_POLICY_V1) return snapshot;
  return deepFreeze(structuredClone(snapshot));
}

/** Return the approved versioned content without implying operational readiness. */
export function readApprovedDataPolicy(snapshot: unknown = DATA_POLICY_V1): DataPolicyReadResultV1 {
  if (snapshot === null || snapshot === undefined) {
    return { status: 'blocked', reason: 'policy_missing' };
  }
  if (!isDataPolicyV1(snapshot)) {
    return { status: 'blocked', reason: 'policy_incomplete' };
  }
  if (snapshot.ownerApproval.status !== 'approved') {
    return { status: 'blocked', reason: 'policy_not_approved' };
  }

  const policy = immutableSnapshot(snapshot);
  return { status: 'available', policy, summary: policy.summary };
}

/** Keep owner approval separate from the operational gate for customer data. */
export function decideDataUse(
  snapshot: unknown,
  action: DataUseActionV1,
): DataUseDecisionV1 {
  const readResult = readApprovedDataPolicy(snapshot);
  if (readResult.status === 'blocked') {
    return { allowed: false, action, reason: readResult.reason };
  }
  if (readResult.policy !== DATA_POLICY_V1) {
    return { allowed: false, action, reason: 'policy_not_current' };
  }

  const operationsVerified = DATA_POLICY_OPERATIONAL_CHECKS_V1.every(
    (check) => readResult.policy.operationalReadiness[check] === 'verified',
  );
  if (!operationsVerified) {
    return { allowed: false, action, reason: 'operational_validation_pending' };
  }

  return { allowed: true, action, version: readResult.policy.version };
}
