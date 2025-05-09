
import { 
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  Connection
} from '@solana/web3.js';
import { 
  createInitializeMintInstruction,
  ExtensionType,
  getMintLen,
  createInitializeMetadataPointerInstruction,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token';
import { createInitializeInstruction } from '@solana/spl-token';
import { TokenMetadata, TokenCreationResult, EventDetails } from './types';
import { SignerWalletAdapter } from '@solana/wallet-adapter-base';
import { calculateMetadataSize, METADATA_TYPE_SIZE, METADATA_LENGTH_SIZE } from './tokenMetadataUtils';

/**
 * Creates a token with metadata
 */
export const createToken = async (
  eventDetails: EventDetails,
  walletAddress: string,
  connection: Connection,
  signTransaction: SignerWalletAdapter['signTransaction']
): Promise<TokenCreationResult> => {
  console.log('Creating token with metadata for event:', eventDetails.title);
  console.log('Using wallet:', walletAddress);

  try {
    // Generate a new keypair for the mint
    const mint = Keypair.generate();
    
    // Set token metadata
    const metadata: TokenMetadata = {
      mint: mint.publicKey,
      name: eventDetails.title,
      symbol: eventDetails.symbol,
      uri: eventDetails.imageUrl,
      additionalMetadata: [
        ['description', eventDetails.description],
        ['date', eventDetails.date],
        ['time', eventDetails.time],
        ['location', eventDetails.location],
        ['supply', eventDetails.attendeeCount.toString()]
      ]
    };
    
    // Generate random ID for this event (in a real app, this could be a database ID)
    const eventId = `event-${Date.now().toString(16)}-${Math.random().toString(16).substring(2, 8)}`;

    // Initialize Transaction
    const transaction = new Transaction();
    const walletPubkey = new PublicKey(walletAddress);
    
    // Calculate space needed for mint with correct extensions
    const extensions = [ExtensionType.MetadataPointer];
    const mintLen = getMintLen(extensions);
    
    console.log(`Creating mint account with calculated space: ${mintLen} bytes`);
    
    // Calculate the metadata length based on our utility function
    const metadataLen = METADATA_TYPE_SIZE + METADATA_LENGTH_SIZE + calculateMetadataSize(metadata);
    const totalMintLen = mintLen + metadataLen;
    
    console.log(`Total mint length including metadata: ${totalMintLen} bytes`);
    
    // Calculate minimum required lamports for rent exemption based on total size
    const mintLamports = await connection.getMinimumBalanceForRentExemption(totalMintLen);
    console.log(`Mint lamports required: ${mintLamports}`);
    
    // Step 1: Create account for the mint with correct space allocation
    const createAccountInstruction = SystemProgram.createAccount({
      fromPubkey: walletPubkey,
      newAccountPubkey: mint.publicKey,
      space: totalMintLen, // Using total calculated mint length with metadata
      lamports: mintLamports,
      programId: TOKEN_2022_PROGRAM_ID
    });
    
    // Step 2: Initialize the MetadataPointer extension
    // This allows the mint to point to itself for metadata
    const metadataPointerInstruction = createInitializeMetadataPointerInstruction(
      mint.publicKey,
      walletPubkey,
      mint.publicKey, // Point to self for metadata
      TOKEN_2022_PROGRAM_ID
    );
    
    // Step 3: Initialize the mint with decimals
    const decimals = eventDetails.decimals || 0;
    const initializeMintInstruction = createInitializeMintInstruction(
      mint.publicKey,
      decimals,
      walletPubkey, // Mint authority
      null, // Freeze authority (null = no freeze)
      TOKEN_2022_PROGRAM_ID
    );
    
    // Step 4: Initialize metadata for the token
    const initializeMetadataInstruction = createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority: walletPubkey,
      updateAuthority: walletPubkey
    });
    
    // Add all instructions to the transaction IN THE CORRECT ORDER
    transaction.add(
      createAccountInstruction,
      metadataPointerInstruction,
      initializeMintInstruction,
      initializeMetadataInstruction
    );
    
    // Set fee payer and recent blockhash
    transaction.feePayer = walletPubkey;
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    
    // Partially sign with the mint keypair since it's a new account
    transaction.partialSign(mint);
    
    console.log("Transaction prepared, requesting wallet signature...");
    
    // Have the wallet sign the transaction
    const signedTransaction = await signTransaction(transaction);
    
    console.log("Transaction signed by wallet, sending to network...");
    
    // Send and confirm the transaction
    const txid = await connection.sendRawTransaction(signedTransaction.serialize());
    
    console.log("Transaction sent with ID:", txid);
    console.log("Waiting for confirmation...");
    
    // Wait for confirmation with more detailed options
    await connection.confirmTransaction({
      signature: txid,
      blockhash: blockhash,
      lastValidBlockHeight: (await connection.getBlockHeight()) + 150
    }, 'confirmed');
    
    // Store event data in local storage (in a real app, this would be in a database)
    const eventDataKey = `event-${eventId}`;
    localStorage.setItem(eventDataKey, JSON.stringify({
      id: eventId,
      mintAddress: mint.publicKey.toBase58(),
      ...eventDetails,
      createdAt: new Date().toISOString(),
      creator: walletAddress
    }));
    
    console.log('Token created successfully with txid:', txid);
    
    return {
      eventId,
      mintAddress: mint.publicKey.toBase58(),
      transactionId: txid
    };
  } catch (error) {
    console.error('Error creating token:', error);
    throw new Error(`Failed to create token: ${error instanceof Error ? error.message : String(error)}`);
  }
};
