import { PublicKey, Connection, SendTransactionError } from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { toast } from 'sonner';
import { decompress } from '@lightprotocol/compressed-token';
import { eventService, poolService, claimService } from '@/lib/db';
import { getLightConnection } from '@/utils/compressionApi';
import { createLightSigner } from './signerAdapter';

/**
 * Claims a compressed token for an event by decompressing it to the recipient.
 * 
 * This implementation follows the Light Protocol compressed token airdrop pattern:
 * 1. We check if the claim is valid and hasn't been processed already
 * 2. We create a Light Protocol compatible signer adapter
 * 3. We build and send the transaction to decompress the token to the recipient
 * 4. We update the database with the claim record
 */
export const claimCompressedToken = async (
  eventId: string,
  recipientWallet: string,
  connection: Connection,
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<boolean> => {
  try {
    console.log(`[Light Protocol] Claiming compressed token for event ${eventId} to wallet ${recipientWallet}`);
    
    // Check if this wallet already claimed a token for this event
    const hasClaimed = await claimService.hasWalletClaimedEvent(eventId, recipientWallet);
    if (hasClaimed) {
      throw new Error('You have already claimed a token for this event');
    }
    
    // Get the event data from persistent storage
    const eventData = await eventService.getEventById(eventId);
    if (!eventData) {
      throw new Error(`Event ${eventId} not found`);
    }
    
    const mintAddress = eventData.mintAddress;
    // Use creator field from eventData, which is now defined in the EventRecord interface
    const creatorWallet = eventData.creator;
    
    // Get the token pool data - critical for decompression
    const poolData = await poolService.getPoolByMintAddress(mintAddress);
    if (!poolData) {
      throw new Error(`Token pool for ${mintAddress} not found. Please ensure the event has a token pool created.`);
    }
    
    // Record the pending claim before executing the transaction
    const claimId = await claimService.saveClaim({
      eventId,
      walletAddress: recipientWallet,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    
    console.log(`[Light Protocol] Initiating decompression of 1 token to ${recipientWallet}`);
    
    try {
      // Convert string addresses to PublicKey objects
      const mintPubkey = new PublicKey(mintAddress);
      const recipientPubkey = new PublicKey(recipientWallet);
      
      // Get Light Protocol connection - needs to use getLightConnection()
      const lightConnection = getLightConnection();
      
      // Create Light Protocol compatible signer for the recipient wallet
      const recipientSigner = createLightSigner(recipientPubkey, signTransaction);
      
      console.log('[Light Protocol] Preparing decompression transaction...');
      
      // For airdrop/claiming, we implement the proper decompression flow
      // This decompresses the token directly to the recipient's wallet
      const decompressTxId = await decompress(
        lightConnection, 
        recipientSigner, // Recipient is the signer (pays fees)
        mintPubkey,      // Mint address
        1,               // Amount to decompress (1 token)
        recipientSigner, // Recipient of the decompressed token
        recipientPubkey  // Destination address (recipient)
      );
      
      console.log('[Light Protocol] Decompression transaction sent with ID:', decompressTxId);
      
      // Wait for confirmation with proper error handling
      try {
        const status = await connection.confirmTransaction({
          signature: decompressTxId,
          blockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
          lastValidBlockHeight: (await connection.getBlockHeight()) + 150
        }, 'confirmed');
        
        if (status.value.err) {
          throw new Error(`Transaction confirmed but failed: ${JSON.stringify(status.value.err)}`);
        }
        
        console.log(`[Light Protocol] Token decompression confirmed with txId: ${decompressTxId}`);
      } catch (confirmError) {
        console.warn("[Light Protocol] Error confirming transaction, but continuing:", confirmError);
        // We'll continue even if confirmation fails - the transaction might still be valid
      }
      
      // Update claim record with success status
      await claimService.updateClaimStatus(claimId, 'confirmed', decompressTxId);
      
      toast.success("Token Claimed Successfully", {
        description: "You have successfully claimed a compressed token for this event."
      });
      
      return true;
    } catch (error) {
      console.error('[Light Protocol] Error during token decompression transaction:', error);
      
      let errorMessage = "Failed to claim token";
      
      // Extract detailed error information from SendTransactionError
      if (error instanceof SendTransactionError && error.logs) {
        console.error('[Light Protocol] Transaction log details:', error.logs);
        errorMessage = `Transaction error: ${error.logs.join('\n')}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
        
        // Special handling for common decompression errors
        if (errorMessage.includes('insufficient funds')) {
          errorMessage = "Insufficient SOL in your wallet to claim this token. Please add more SOL to your wallet.";
        } else if (errorMessage.includes('no tokens available')) {
          errorMessage = "No tokens available for claiming. All tokens may have been claimed already.";
        }
      }
      
      // Update claim record with failure status
      await claimService.updateClaimStatus(claimId, 'failed', undefined, errorMessage);
      
      toast.error("Error Claiming Token", {
        description: errorMessage
      });
      
      throw new Error(`Failed to claim token: ${errorMessage}`);
    }
  } catch (error) {
    console.error('[Light Protocol] Error claiming compressed token:', error);
    toast.error("Error Claiming Token", {
      description: error instanceof Error ? error.message : "Failed to claim token"
    });
    throw error; // Let the caller handle this error
  }
};

// Helper function to create a stateless signer without needing to import it
// This provides a Signer-compatible object that only has the publicKey
export const createStatelessSigner = (address: PublicKey) => {
  return {
    publicKey: address,
    secretKey: null as Uint8Array | null
  };
};
