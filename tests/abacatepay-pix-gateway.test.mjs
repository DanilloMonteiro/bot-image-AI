import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { AbacatePayPixGateway } = require('../dist/adapters/abacatepay/pix-gateway.js');

test('AbacatePay gateway uses Dev mode API with opaque external ID and parses Pix instructions', async () => {
  let received;
  const gateway = new AbacatePayPixGateway({
    ABACATEPAY_MODE: 'dev',
    ABACATEPAY_DEV_API_KEY: 'sandbox-token',
  }, async (url, init) => {
    received = { url: String(url), init };
    return Response.json({
      success: true,
      data: {
        id: 'pix_sandbox_001', amount: 100, status: 'PENDING', devMode: true,
        brCode: '000201-sandbox', brCodeBase64: 'data:image/png;base64,AAAA',
        expiresAt: '2026-10-28T13:00:00.000Z',
      },
    });
  });
  const result = await gateway.create({
    amountMinor: 100, externalOrderId: 'pix-request-001',
    description: 'Sandbox order synthetic-id', mode: 'sandbox',
  });
  assert.equal(received.url, 'https://api.abacatepay.com/v2/transparents/create');
  assert.equal(received.init.method, 'POST');
  const body = JSON.parse(received.init.body);
  assert.equal(body.method, 'PIX');
  assert.equal(body.data.externalId, 'pix-request-001');
  assert.equal(body.data.amount, 100);
  assert.equal(result.providerReference, 'pix_sandbox_001');
  assert.equal(result.devMode, true);
});

test('AbacatePay simulate-payment is restricted to Dev mode and uses checkout id query', async () => {
  let receivedUrl;
  const gateway = new AbacatePayPixGateway({
    ABACATEPAY_MODE: 'dev', ABACATEPAY_DEV_API_KEY: 'sandbox-token',
  }, async (url) => {
    receivedUrl = String(url);
    return Response.json({ success: true, data: { devMode: true } });
  });
  await gateway.simulatePayment('pix_sandbox_001');
  assert.equal(receivedUrl,
    'https://api.abacatepay.com/v2/transparents/simulate-payment?id=pix_sandbox_001');
});

test('AbacatePay configuration preflight requires the selected mode and API key', () => {
  const missingDevKey = new AbacatePayPixGateway({ ABACATEPAY_MODE: 'dev' }, async () => {
    throw new Error('preflight must not call fetch');
  });
  const wrongMode = new AbacatePayPixGateway({
    ABACATEPAY_MODE: 'production', ABACATEPAY_PROD_API_KEY: 'production-token',
  }, async () => { throw new Error('preflight must not call fetch'); });
  const configured = new AbacatePayPixGateway({
    ABACATEPAY_MODE: 'dev', ABACATEPAY_DEV_API_KEY: 'dev-token',
  }, async () => { throw new Error('preflight must not call fetch'); });
  assert.equal(missingDevKey.isConfigured('sandbox'), false);
  assert.equal(wrongMode.isConfigured('sandbox'), false);
  assert.equal(wrongMode.isConfigured('production'), true);
  assert.equal(configured.isConfigured('sandbox'), true);
});
