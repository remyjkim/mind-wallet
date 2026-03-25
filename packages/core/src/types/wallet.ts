// ABOUTME: WalletAdapter interface and related types for signing operations
// ABOUTME: OWS-compatible; any signer that implements this interface is usable

export interface WalletAccount {
  chainId: string;   // CAIP-2: e.g. "eip155:8453", "solana:5eykt4..."
  address: string;   // CAIP-10 address
}

export interface SignRequest {
  walletId: string;
  chainId: string;
  transaction: unknown;  // chain-specific transaction object
}

export interface MessageRequest {
  walletId: string;
  chainId: string;
  message: string;
  encoding?: 'utf8' | 'hex';
  accountIndex?: number;
}

export interface WalletAdapter {
  sign(request: SignRequest): Promise<string>;
  signMessage(request: MessageRequest): Promise<string>;
  getAccount(walletId: string, chainId: string): Promise<WalletAccount>;
  canSign(chainId: string): Promise<boolean>;
}
