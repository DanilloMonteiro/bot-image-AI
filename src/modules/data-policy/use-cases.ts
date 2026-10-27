import { isDataPolicyV1 } from '../../contracts/data-policy/v1.js';
import {
  isDataPolicyV2,
  type DataPolicyV2,
} from '../../contracts/data-policy/v2.js';
import { DATA_POLICY_V2 } from './policy-v2.js';

export type DataPolicyBlockReasonV2 =
  | 'policy_missing'
  | 'policy_incomplete'
  | 'policy_not_approved'
  | 'policy_not_current'
  | 'local_deletion_unverified';

export type DataPolicyReadResultV2 =
  | { status: 'available'; policy: DataPolicyV2; summary: string }
  | {
    status: 'blocked';
    reason: Exclude<DataPolicyBlockReasonV2, 'local_deletion_unverified'>;
  };

export type DataUseActionV2 = 'collect' | 'process';

export type DataUseDecisionV2 =
  | { allowed: true; action: DataUseActionV2; version: DataPolicyV2['version'] }
  | { allowed: false; action: DataUseActionV2; reason: DataPolicyBlockReasonV2 };

/** Return the approved versioned content without implying operational readiness. */
export function readApprovedDataPolicy(snapshot: unknown = DATA_POLICY_V2): DataPolicyReadResultV2 {
  if (snapshot === null || snapshot === undefined) {
    return { status: 'blocked', reason: 'policy_missing' };
  }
  if (isDataPolicyV1(snapshot)) {
    return { status: 'blocked', reason: 'policy_not_current' };
  }
  if (!isDataPolicyV2(snapshot)) {
    return { status: 'blocked', reason: 'policy_incomplete' };
  }
  if (snapshot.ownerApproval.status !== 'approved') {
    return { status: 'blocked', reason: 'policy_not_approved' };
  }
  if (snapshot !== DATA_POLICY_V2) {
    return { status: 'blocked', reason: 'policy_not_current' };
  }

  return { status: 'available', policy: DATA_POLICY_V2, summary: DATA_POLICY_V2.summary };
}

/** Keep owner approval separate from the operational gate for customer data. */
export function decideDataUse(
  snapshot: unknown,
  action: DataUseActionV2,
): DataUseDecisionV2 {
  const readResult = readApprovedDataPolicy(snapshot);
  if (readResult.status === 'blocked') {
    return { allowed: false, action, reason: readResult.reason };
  }
  if (readResult.policy.operationalReadiness.localDeletion !== 'verified') {
    return { allowed: false, action, reason: 'local_deletion_unverified' };
  }

  return { allowed: true, action, version: readResult.policy.version };
}
