export type ReadinessResult = {
  status: 200 | 503;
  body: { status: 'ok' | 'unavailable' };
};

export async function getReadinessResult(check: () => Promise<boolean>): Promise<ReadinessResult> {
  try {
    if (await check()) return { status: 200, body: { status: 'ok' } };
  } catch {
    // Health responses intentionally hide dependency details.
  }
  return { status: 503, body: { status: 'unavailable' } };
}

export function readinessResponse(result: ReadinessResult): Response {
  return Response.json(result.body, {
    status: result.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
