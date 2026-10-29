import { SANDBOX_OFFER_V1 } from '../../contracts/orders-payments/v1';

export function readOrderCatalog() {
  return {
    version: 'v1' as const,
    productionOffers: [] as const,
    sandboxOffers: [SANDBOX_OFFER_V1],
  };
}

export function findSandboxOffer(offerId: string) {
  return offerId === SANDBOX_OFFER_V1.offerId ? SANDBOX_OFFER_V1 : null;
}
