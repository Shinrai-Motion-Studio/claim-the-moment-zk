
import { 
  Connection, 
  PublicKey, 
  TransactionSignature 
} from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { compress } from '@lightprotocol/compressed-token';
import { toast } from 'sonner';
import { TOKEN_2022_PROGRAM_ID } from '../types';
import { createLightSigner } from './signerAdapter';
import { getDevnetConnection } from '@/utils/compressionApi';

/**
 * Compresses tokens for an event after pool creation
 * This follows the Light Protocol airdrop pattern where tokens are pre-compressed
 * and then decompressed on-demand when claimed
 */
export const compressTokens = async (
  mintAddress: string, 
  amount: number,
  ownerAddress: string,
  connection: Connection,
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<TransactionSignature> => {
  try {
    console.log(`[Light Protocol] Compressing ${amount} tokens for mint ${mintAddress}`);
    
    // Convert addresses to PublicKey
    const mintPubkey = new PublicKey(mintAddress);
    const ownerPubkey = new PublicKey(ownerAddress);
    
    // Create Light Protocol compatible signer
    const lightSigner = createLightSigner(ownerPubkey, signTransaction);
    
    console.log('[Light Protocol] Starting token compression process');
    
    // Get token account info - we need the actual ATA where tokens exist
    const ataAccounts = await connection.getTokenAccountsByOwner(
      ownerPubkey, 
      { mint: mintPubkey }
    );
    
    if (ataAccounts.value.length === 0) {
      throw new Error('No token account found for this mint. Please ensure tokens are minted before compressing.');
    }
    
    // Use the first token account found
    const tokenAccountPubkey = ataAccounts.value[0].pubkey;
    
    console.log(`[Light Protocol] Found token account: ${tokenAccountPubkey.toString()}`);
    
    // Call Light Protocol to compress the tokens with all required arguments
    const compressTxid = await compress(
      connection,
      lightSigner,          // Owner of tokens (signer)
      mintPubkey,           // Mint address
      amount,               // Amount to compress
      lightSigner,          // Owner (signer)
      tokenAccountPubkey,   // Source token account (ATA)
      ownerPubkey,          // Destination for compressed tokens
      undefined             // Optional fee payer
    );
    
    console.log(`[Light Protocol] Compression transaction sent: ${compressTxid}`);
    
    // Wait for confirmation
    try {
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      
      const confirmation = await connection.confirmTransaction({
        signature: compressTxid,
        blockhash,
        lastValidBlockHeight
      }, 'confirmed');
      
      if (confirmation.value.err) {
        console.warn(`[Light Protocol] Compression transaction confirmed but with error: ${JSON.stringify(confirmation.value.err)}`);
      } else {
        console.log('[Light Protocol] Compression transaction confirmed successfully');
      }
    } catch (confirmError) {
      console.warn('[Light Protocol] Error confirming compression transaction:', confirmError);
      // Continue even if confirmation checks fail, transaction might still be valid
    }
    
    return compressTxid;
  } catch (error) {
    console.error('[Light Protocol] Error compressing tokens:', error);
    
    let errorMessage = 'Failed to compress tokens';
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Improve error message for common compression issues
      if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Insufficient SOL in wallet to compress tokens. Please add more SOL.';
      } else if (errorMessage.includes('InvalidOwner')) {
        errorMessage = 'Invalid ownership of tokens. Please ensure you own the tokens you are trying to compress.';
      }
    }
    
    toast.error('Token Compression Failed', {
      description: errorMessage
    });
    
    throw new Error(`Failed to compress tokens: ${errorMessage}`);
  }
};
