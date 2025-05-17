
import { 
  PublicKey, 
  TransactionSignature 
} from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { compress } from '@lightprotocol/compressed-token';
import { toast } from 'sonner';
import { TOKEN_2022_PROGRAM_ID } from '../types';
import { createLightSigner } from './signerAdapter';
import { getLightConnection } from '@/utils/compressionApi';

/**
 * Compresses tokens for an event after pool creation
 */
export const compressTokens = async (
  mintAddress: string, 
  amount: number,
  ownerAddress: string,
  connection: any, // Standard connection used only for queries
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
    
    // Get Light Protocol connection with proper Rpc type
    const lightConnection = getLightConnection();
    
    // Get token account info - we need the actual ATA where tokens exist
    // Note: We'll still use the standard connection for queries
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
    
    // Call Light Protocol to compress the tokens using lightConnection with proper Rpc type
    const compressTxid = await compress(
      lightConnection,    // Use Light connection with proper Rpc type
      lightSigner,        // Owner of tokens (signer)
      mintPubkey,         // Mint address
      amount,             // Amount to compress
      lightSigner,        // Owner (signer)
      tokenAccountPubkey, // Source token account (ATA)
      ownerPubkey         // Destination for compressed tokens
    );
    
    console.log(`[Light Protocol] Compression transaction sent: ${compressTxid}`);
    
    // Wait for confirmation using standard connection
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
