
import { PublicKey, Signer, Transaction, VersionedTransaction } from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';

/**
 * Creates a Light Protocol compatible signer from a wallet adapter's signTransaction function
 * and a public key.
 * 
 * IMPROVED VERSION: Adds better error handling and transaction logging to help diagnose
 * signature verification failures in Light Protocol.
 */
export const createLightSigner = (
  walletPubkey: PublicKey,
  signTransaction: SignerWalletAdapter['signTransaction']
): LightSigner => {
  return {
    publicKey: walletPubkey,
    signTransaction: async (transaction: Transaction | VersionedTransaction) => {
      try {
        // Add transaction inspection before signing with proper type checking
        if (transaction instanceof Transaction) {
          console.log("Transaction to sign:", {
            feePayer: transaction.feePayer?.toBase58(),
            recentBlockhash: transaction.recentBlockhash || 'none',
            instructions: transaction.instructions.length,
            signerPubkey: walletPubkey.toBase58()
          });
          
          // CRITICAL FIX: Pre-sign with offline workflow to ensure proper signing
          // This helps Light Protocol verify signatures correctly
          console.log("Ensuring transaction is ready for signing with proper fee payer");
          if (!transaction.feePayer) {
            transaction.feePayer = walletPubkey;
          }
          
          if (!transaction.recentBlockhash) {
            console.warn("Transaction is missing recentBlockhash - Light Protocol may reject it");
          }
        } else if (transaction instanceof VersionedTransaction) {
          console.log("VersionedTransaction to sign:", {
            version: transaction.version,
            signatures: transaction.signatures.length,
            signerPubkey: walletPubkey.toBase58()
          });
        } else {
          console.log("Unknown transaction type to sign");
        }
        
        // Let the wallet sign the transaction
        console.log("Passing transaction to wallet for signing...");
        const signedTx = await signTransaction(transaction);
        console.log("Transaction signed successfully by wallet");
        
        // Verify the signatures after wallet signing for regular transactions
        if (transaction instanceof Transaction) {
          if (!transaction.verifySignatures()) {
            console.warn("Transaction signature verification failed after wallet signing");
            // Additional diagnostic info
            console.error("Transaction signature details:", {
              signatures: transaction.signatures.map(s => ({
                pubkey: s.publicKey.toBase58(),
                signature: s.signature ? "present" : "missing"
              }))
            });
          } else {
            console.log("Transaction signatures verified successfully");
          }
        } else {
          console.log("Skipping verification for VersionedTransaction");
        }
        
        return signedTx;
      } catch (error) {
        console.error("Error in Light Protocol signer during signing:", error);
        throw error; // Re-throw to allow proper error handling
      }
    },
    // Add a dummy secretKey that satisfies the Signer interface
    secretKey: new Uint8Array(64) // This won't be used in browser environments
  };
};

// Define our custom signer type that matches what Light Protocol expects in browser
export interface LightSigner {
  publicKey: PublicKey;
  secretKey: Uint8Array; // Required by @solana/web3.js Signer type
  signTransaction: (transaction: Transaction | VersionedTransaction) => Promise<Transaction | VersionedTransaction>;
}

// Ensure our LightSigner satisfies the Signer interface
export type BrowserCompatibleSigner = Signer & {
  signTransaction: SignerWalletAdapter['signTransaction'];
};
