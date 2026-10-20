import { createServer, type Server } from 'node:http';
import { getReadinessResult } from '../adapters/http/readiness-handler.js';

export function createWorkerHealthServer(check: () => Promise<boolean>): Server {
  return createServer(async (request, response) => {
    if (request.method !== 'GET' || request.url !== '/health') {
      response.writeHead(404, { 'Cache-Control': 'no-store' });
      response.end();
      return;
    }

    const result = await getReadinessResult(check);
    response.writeHead(result.status, {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    });
    response.end(JSON.stringify(result.body));
  });
}
