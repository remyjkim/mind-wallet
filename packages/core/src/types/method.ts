// ABOUTME: RouterMethod interface implemented by each payment protocol
// ABOUTME: Bridges the selection pipeline to protocol-specific credential creation

import type { PaymentCandidate, NormalizedPayment, Protocol } from './challenge.js';
import type { WalletAdapter } from './wallet.js';

export interface RouterMethod {
  id: string;
  protocol: Protocol;
  canHandle(candidate: PaymentCandidate): boolean;
  normalize(raw: unknown): NormalizedPayment;
  createCredential(args: {
    candidate: PaymentCandidate;
    wallet: WalletAdapter;
  }): Promise<Record<string, string>>;
}
