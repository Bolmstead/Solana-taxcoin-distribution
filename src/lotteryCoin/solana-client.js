const { Connection, PublicKey, Keypair, sendAndConfirmTransaction, Transaction } = require('@solana/web3.js');
const { Program, BN, AnchorProvider, web3 } = require('@project-serum/anchor');
const { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const fs = require('fs');

// Load the IDL (Interface Definition Language) for your program
const idl = JSON.parse(fs.readFileSync('./target/idl/tax_token.json', 'utf8'));
const programId = new PublicKey("YOUR_PROGRAM_ID");

// Connect to the Solana cluster
const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');

// Load your wallet keypair (from a file for this example)
const walletKeypair = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync('./keypair.json', 'utf8')))
);

// Create the wallet and provider
const wallet = {
  publicKey: walletKeypair.publicKey,
  signTransaction: (tx) => tx.partialSign(walletKeypair),
  signAllTransactions: (txs) => txs.map((tx) => tx.partialSign(walletKeypair)),
};

const provider = new AnchorProvider(connection, wallet, {
  preflightCommitment: 'confirmed',
});

// Create a program instance
const program = new Program(idl, programId, provider);

// Initialize a new token with 5% tax
async function initializeToken() {
  // Generate a new mint keypair
  const mintKeypair = Keypair.generate();
  const mint = mintKeypair.publicKey;
  
  // Get the token info account
  const [tokenInfoPDA] = await PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), mint.toBuffer()],
    program.programId
  );
  
  // Get the authority's associated token account
  const authorityTokenAccount = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey
  );
  
  console.log('Initializing token...');
  
  // Token parameters
  const name = "TaxToken";
  const symbol = "TAX";
  const decimals = 9;
  const taxRate = new BN(500);  // 5% (in basis points)
  
  // Define the tax recipient address where taxes will be sent automatically
  // This can be any wallet address
  const taxRecipientAddress = new PublicKey("TAX_RECIPIENT_WALLET_ADDRESS_HERE");
  
  // Initialize the token
  await program.methods
    .initializeToken(name, symbol, decimals, taxRate, taxRecipientAddress)
    .accounts({
      authority: wallet.publicKey,
      tokenInfo: tokenInfoPDA,
      mint: mint,
      authorityTokenAccount: authorityTokenAccount,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: web3.SystemProgram.programId,
      rent: web3.SYSVAR_RENT_PUBKEY,
    })
    .signers([mintKeypair])
    .rpc();
  
  console.log('Token initialized!');
  console.log('Mint address:', mint.toString());
  console.log('Token Info PDA:', tokenInfoPDA.toString());
  console.log('Tax Recipient:', taxRecipientAddress.toString());
  
  return { mint, tokenInfoPDA, taxRecipientAddress };
}

// Transfer tokens with tax
async function transferWithTax(mint, recipient, amount) {
  // Get the token info account
  const [tokenInfoPDA] = await PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), mint.toBuffer()],
    program.programId
  );
  
  // Get the sender's token account
  const fromTokenAccount = await getAssociatedTokenAddress(
    mint,
    wallet.publicKey
  );
  
  // Get or create recipient token account
  const toTokenAccount = await getAssociatedTokenAddress(
    mint,
    recipient
  );
  
  // Get the token info to find the tax recipient
  const tokenInfo = await program.account.tokenInfo.fetch(tokenInfoPDA);
  const taxRecipient = tokenInfo.taxRecipient;
  
  // Get the tax recipient token account
  const taxRecipientTokenAccount = await getAssociatedTokenAddress(
    mint,
    taxRecipient
  );
  
  console.log(`Transferring ${amount} tokens with 5% tax...`);
  
  // Check if recipient and tax recipient token accounts exist, if not create them
  let transaction = new Transaction();
  
  // Check recipient account
  try {
    await connection.getTokenAccountBalance(toTokenAccount);
  } catch (e) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        toTokenAccount,
        recipient,
        mint
      )
    );
  }
  
  // Check tax recipient account
  try {
    await connection.getTokenAccountBalance(taxRecipientTokenAccount);
  } catch (e) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,
        taxRecipientTokenAccount,
        taxRecipient,
        mint
      )
    );
  }
  
  // Perform the taxed transfer
  await program.methods
    .taxedTransfer(new BN(amount))
    .accounts({
      authority: wallet.publicKey,
      from: fromTokenAccount,
      to: toTokenAccount,
      taxRecipient: taxRecipientTokenAccount,
      tokenInfo: tokenInfoPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .transaction();
  
  // Send the transaction
  await sendAndConfirmTransaction(connection, transaction, [walletKeypair]);
  
  console.log('Transfer completed!');
  
  // Calculate and display the expected tax amount
  const taxRate = tokenInfo.taxRate.toNumber() / 10000;
  const taxAmount = Math.floor(amount * taxRate);
  const transferAmount = amount - taxAmount;
  
  console.log(`Amount sent to recipient: ${transferAmount}`);
  console.log(`Tax automatically sent to tax recipient: ${taxAmount}`);
}

// Update tax recipient address
async function updateTaxRecipient(mint, newTaxRecipient) {
  // Get the token info account
  const [tokenInfoPDA] = await PublicKey.findProgramAddressSync(
    [Buffer.from("token_info"), mint.toBuffer()],
    program.programId
  );
  
  console.log(`Updating tax recipient to: ${newTaxRecipient.toString()}...`);
  
  // Update the tax recipient
  await program.methods
    .updateTaxRecipient(newTaxRecipient)
    .accounts({
      authority: wallet.publicKey,
      tokenInfo: tokenInfoPDA,
      systemProgram: web3.SystemProgram.programId,
    })
    .rpc();
  
  console.log('Tax recipient updated successfully!');
}

// Example usage:
async function main() {
  try {
    // Initialize the token with a tax recipient
    const { mint } = await initializeToken();
    
    // Transfer tokens to another address (tax is automatically sent to tax recipient)
    const recipientPublicKey = new PublicKey("RECIPIENT_ADDRESS_HERE");
    await transferWithTax(mint, recipientPublicKey, 1000000000); // 1 token with 9 decimals
    
    // Optionally, update the tax recipient if needed
    const newTaxRecipientPublicKey = new PublicKey("NEW_TAX_RECIPIENT_ADDRESS");
    await updateTaxRecipient(mint, newTaxRecipientPublicKey);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
