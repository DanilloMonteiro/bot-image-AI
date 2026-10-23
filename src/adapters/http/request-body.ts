const bodyReadTimeoutMs = 1_000;
const maximumEmptyBodyReads = 16;

export async function hasNonEmptyBody(request: Request): Promise<boolean> {
  if (!request.body) return false;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let shouldCancel = false;
  try {
    reader = request.body.getReader();
    const deadline = Date.now() + bodyReadTimeoutMs;
    let reads = 0;
    while (true) {
      if (reads >= maximumEmptyBodyReads) {
        shouldCancel = true;
        return true;
      }
      reads += 1;

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        shouldCancel = true;
        return true;
      }

      let timeout: ReturnType<typeof setTimeout> | undefined;
      let result: Awaited<ReturnType<typeof reader.read>>;
      try {
        result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(new Error('request body read timed out')), remainingMs);
          }),
        ]);
      } finally {
        if (timeout) clearTimeout(timeout);
      }

      const { done, value } = result;
      if (done) return false;
      if (value?.byteLength) {
        shouldCancel = true;
        return true;
      }
    }
  } catch {
    shouldCancel = true;
    return true;
  } finally {
    if (reader && shouldCancel) {
      try {
        void reader.cancel().catch(() => undefined);
      } catch {
        // Cancellation is best-effort; the request is rejected either way.
      }
    }
    if (reader) {
      try {
        reader.releaseLock();
      } catch {
        // A timed-out read may still be settling after cancellation.
      }
    }
  }
}
