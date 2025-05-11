
import { PublicKey, Connection, SendTransactionError } from '@solana/web3.js';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { toast } from 'sonner';
import { transfer } from '@lightprotocol/compressed-token';
import { eventService, poolService, claimService } from '@/lib/db';
import { getLightRpc } from '@/utils/compressionApi';
import { createLightSigner, LightSigner, BrowserSigner } from './signerAdapter';

/**
 * Claims a compressed token for an event.
 * 
 * Following the Light Protocol browser pattern:
 * 1. We check if the claim is valid and hasn't been processed already
 * 2. We create a Light Protocol compatible signer adapter
 * 3. We build and send the transaction using Light Protocol's libraries
 * 4. We update the database with the transaction result
 */
export const claimCompressedToken = async (
  eventId: string,
  recipientWallet: string,
  connection: Connection,
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<boolean> => {
  try {
    console.log(`Claiming compressed token for event ${eventId} to wallet ${recipientWallet}`);
    
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
    const creatorWallet = eventData.creator;
    
    // Get the token pool data
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
    
    console.log(`Initiating transfer of 1 token from ${creatorWallet} to ${recipientWallet}`);
    
    try {
      // Convert string addresses to PublicKey objects
      const mintPubkey = new PublicKey(mintAddress);
      const recipientPubkey = new PublicKey(recipientWallet);
      
      // Get Light Protocol RPC instance
      const lightRpc = getLightRpc();
      
      // Create Light Protocol compatible signer for the current wallet
      const recipientSigner = createLightSigner(recipientPubkey, signTransaction);
      
      console.log('Preparing transfer transaction with Light Protocol...');
      
      // Following the Light Protocol pattern in browser environments:
      // In browser context, we use a Keypair-like object where Light Protocol
      // will only use the publicKey for address derivation and the signTransaction
      // function for transaction signing - never accessing the secretKey
      const transferTxId = await transfer(
        lightRpc,
        {
          publicKey: recipientPubkey,
          signTransaction  // Pass the signTransaction function directly
        },
        mintPubkey,
        1, // Transfer 1 token
        recipientPubkey, // From address 
        recipientPubkey  // To address (same as from in this case - self-claim)
      );
      
      console.log('Transfer transaction sent with ID:', transferTxId);
      
      // Wait for confirmation with proper error handling
      const status = await connection.confirmTransaction({
        signature: transferTxId,
        blockhash: (await connection.getLatestBlockhash('confirmed')).blockhash,
        lastValidBlockHeight: (await connection.getBlockHeight()) + 150
      }, 'confirmed');
      
      if (status.value.err) {
        throw new Error(`Transaction confirmed but failed: ${JSON.stringify(status.value.err)}`);
      }
      
      console.log(`Token transfer confirmed with txId: ${transferTxId}`);
      
      // Update claim record with success status
      await claimService.updateClaimStatus(claimId, 'confirmed', transferTxId);
      
      toast.success("Token Claimed Successfully", {
        description: "You have successfully claimed a compressed token for this event."
      });
      
      return true;
    } catch (error) {
      console.error('Error during token claim transaction:', error);
      
      let errorMessage = "Failed to claim token";
      
      // Extract detailed error information from SendTransactionError
      if (error instanceof SendTransactionError && error.logs) {
        console.error('Transaction log details:', error.logs);
        errorMessage = `Transaction error: ${error.logs.join('\n')}`;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      // Update claim record with failure status
      await claimService.updateClaimStatus(claimId, 'failed', undefined, errorMessage);
      
      toast.error("Error Claiming Token", {
        description: errorMessage
      });
      
      throw new Error(`Failed to claim token: ${errorMessage}`);
    }
  } catch (error) {
    console.error('Error claiming compressed token:', error);
    toast.error("Error Claiming Token", {
      description: error instanceof Error ? error.message : "Failed to claim token"
    });
    throw error; // Let the caller handle this error
  }
};
