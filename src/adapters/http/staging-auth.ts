import { timingSafeEqual } from 'node:crypto';

export function isAuthorized(request: Request): boolean {
  const expected = process.env.STAGING_SMOKE_SECRET;
  const supplied = request.headers.get('authorization');
  if (!expected || expected.length < 32 || !supplied?.startsWith('Bearer ')) return false;
  const actual = supplied.slice(7);
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
