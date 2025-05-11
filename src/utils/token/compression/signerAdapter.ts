
import { 
  Transaction, 
  PublicKey, 
  VersionedTransaction,
  TransactionMessage
} from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';

/**
 * Adapter to make wallet signer compatible with Light Protocol
 */
export class LightSignerAdapter {
  publicKey: PublicKey;
  private signTransaction: SignerWalletAdapter['signTransaction'];
  
  constructor(
    walletAddress: string,
    signTransaction: SignerWalletAdapter['signTransaction']
  ) {
    this.publicKey = new PublicKey(walletAddress);
    this.signTransaction = signTransaction;
  }
  
  /**
   * Sign a transaction for Light Protocol
   * This handles both legacy and versioned transactions
   */
  async sign(tx: Transaction | VersionedTransaction): Promise<Transaction | VersionedTransaction> {
    console.log("LightSignerAdapter signing transaction");
    
    // Make sure the transaction is properly formed
    if (tx instanceof Transaction) {
      // Legacy transaction
      console.log("Signing legacy transaction");
      if (!tx.feePayer) {
        tx.feePayer = this.publicKey;
      }
      
      if (!tx.recentBlockhash) {
        throw new Error("Transaction missing recentBlockhash");
      }
      
    } else if (tx instanceof VersionedTransaction) {
      // Versioned transaction (v0)
      console.log("Signing versioned transaction");
      // Versioned transactions are already built with all required fields
    } else {
      throw new Error("Unknown transaction type");
    }
    
    try {
      // Pass to the wallet's signTransaction method
      return await this.signTransaction(tx);
    } catch (error) {
      console.error("Error in LightSignerAdapter.sign:", error);
      throw new Error(`Failed to sign transaction: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
