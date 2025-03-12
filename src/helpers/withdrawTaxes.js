const {
  PublicKey,
  Keypair,
  Transaction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  getAccount,
} = require("@solana/spl-token");
const { connection } = require("../config/solana.js");
const bs58 = require("bs58");
require("dotenv").config();

/**
 * Get the current balance of the withdraw authority
 * @param {PublicKey} tokenAccount Associated token account to check
 * @returns {Promise<number>} Balance in tokens
 */
async function getWithdrawAuthorityBalance(tokenAccount) {
  console.log(
    `\n🔍 Checking balance for token account: ${tokenAccount.toString()}`
  );
  try {
    const account = await getAccount(connection, tokenAccount);
    const balance = Number(account.amount) / Math.pow(10, account.decimals);
    console.log(`💰 Current balance: ${balance} tokens`);
    console.log(`🔢 Decimals: ${account.decimals}`);
    return balance;
  } catch (error) {
    console.error("❌ Failed to get withdraw authority balance:", error);
    throw error;
  }
}

/**
 * Execute tax withdrawal from the withdraw authority to the destination
 * @param {Object} params Parameters for tax withdrawal
 * @param {string} params.withdrawAuthoritySecretKey Secret key of the withdraw authority
 * @param {string} params.tokenMint Token mint address
 * @param {string} params.destinationAddress Destination wallet address
 * @returns {Promise<Object>} Transaction details
 */
async function executeTaxWithdrawal({
  withdrawAuthoritySecretKey,
  tokenMint: tokenMintAddress,
  destinationAddress,
}) {
  try {
    console.log(`
🚀 Initiating Tax Withdrawal:
💎 Token Mint: ${tokenMintAddress}
📤 Destination: ${destinationAddress}
    `);

    // Initialize withdraw authority and token mint
    console.log("🔐 Initializing withdraw authority...");
    const privateKeyBytes = bs58.decode(withdrawAuthoritySecretKey);
    const withdrawAuthority = Keypair.fromSecretKey(privateKeyBytes);
    console.log(
      `👛 Withdraw Authority Public Key: ${withdrawAuthority.publicKey.toString()}`
    );

    console.log("🏦 Initializing token mint...");
    const tokenMint = new PublicKey(tokenMintAddress);

    // Convert destination address to PublicKey
    console.log("🎯 Processing destination address...");
    const destinationPublicKey = new PublicKey(destinationAddress);

    // Get the associated token accounts
    console.log("📋 Deriving associated token accounts...");
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      withdrawAuthority.publicKey
    );
    console.log(`📤 Source Token Account: ${sourceTokenAccount.toString()}`);

    const destinationTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      destinationPublicKey
    );
    console.log(
      `📥 Destination Token Account: ${destinationTokenAccount.toString()}`
    );

    // Check if the withdraw authority has enough funds
    console.log("💱 Verifying available balance...");
    const sourceBalance = await getWithdrawAuthorityBalance(sourceTokenAccount);

    console.log("✅ Balance verification successful!");

    // Get token decimals and calculate the actual amount
    console.log("🔢 Calculating token amounts...");
    const tokenAccount = await getAccount(connection, sourceTokenAccount);
    const decimals = tokenAccount.decimals;
    const adjustedAmount = sourceBalance * Math.pow(10, decimals);
    console.log(`
📊 Token Calculations:
🔢 Decimals: ${decimals}
💰 Raw Amount: ${adjustedAmount}
    `);

    // Create the transfer instruction
    console.log("📝 Creating transfer instruction...");
    const transferInstruction = createTransferInstruction(
      sourceTokenAccount,
      destinationTokenAccount,
      withdrawAuthority.publicKey,
      BigInt(adjustedAmount)
    );
    console.log("✅ Transfer instruction created!");

    // Create and sign transaction
    console.log("📜 Building transaction...");
    const transaction = new Transaction().add(transferInstruction);

    // Set recent blockhash and fee payer
    console.log("🔄 Getting recent blockhash...");
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    transaction.feePayer = withdrawAuthority.publicKey;
    console.log("✅ Transaction prepared!");

    // Sign and send the transaction
    console.log("🖊️ Signing and sending transaction...");
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      withdrawAuthority,
    ]);

    console.log(`
🎉 Tax Withdrawal Successful!
📝 Transaction Details:
🔗 Signature: ${signature}
💰 sourceBalance: ${sourceBalance} tokens
📤 From: ${withdrawAuthority.publicKey.toString()}
📥 To: ${destinationPublicKey.toString()}
⏰ Timestamp: ${new Date().toISOString()}
    `);

    // Return the transaction details
    return {
      signature,
      sourceBalance,
      source: withdrawAuthority.publicKey.toString(),
      destination: destinationPublicKey.toString(),
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`
❌ Tax Withdrawal Failed:
⚠️ Error: ${error.message}
🔍 Stack Trace:
${error.stack}
    `);
    throw error;
  }
}

/**
 * Get tax withdrawal transaction history
 * @param {Object} params Parameters for getting transaction history
 * @param {string} params.withdrawAuthoritySecretKey Secret key of the withdraw authority
 * @param {number} params.limit Maximum number of transactions to retrieve
 * @returns {Promise<Array>} Array of transaction signatures and details
 */
async function getTaxWithdrawalHistory({
  withdrawAuthoritySecretKey,
  limit = 10,
}) {
  try {
    console.log(`
📚 Fetching Tax Withdrawal History:
🔢 Limit: ${limit} transactions
    `);

    console.log("🔐 Initializing withdraw authority...");
    const withdrawAuthority = Keypair.fromSecretKey(
      bs58.decode(withdrawAuthoritySecretKey)
    );

    console.log(
      `👛 Authority Public Key: ${withdrawAuthority.publicKey.toString()}`
    );

    // Get transaction signatures for the withdraw authority
    console.log("🔍 Retrieving transaction signatures...");
    const signatures = await connection.getSignaturesForAddress(
      withdrawAuthority.publicKey,
      { limit }
    );
    console.log(`📝 Found ${signatures.length} transactions`);

    // Get transaction details for each signature
    console.log("📊 Processing transaction details...");
    const transactions = await Promise.all(
      signatures.map(async (sig) => {
        console.log(`🔄 Processing transaction: ${sig.signature}`);
        const tx = await connection.getTransaction(sig.signature, {
          maxSupportedTransactionVersion: 0,
        });

        const details = {
          signature: sig.signature,
          blockTime: sig.blockTime
            ? new Date(sig.blockTime * 1000).toISOString()
            : null,
          status: tx?.meta?.err ? "failed" : "success",
          confirmations: sig.confirmations,
        };

        console.log(`
📄 Transaction Details:
🔗 Signature: ${details.signature}
⏰ Time: ${details.blockTime || "Unknown"}
✨ Status: ${details.status === "success" ? "✅" : "❌"} ${details.status}
🔒 Confirmations: ${details.confirmations}
        `);

        return details;
      })
    );

    console.log(`
✅ History Retrieval Complete:
📊 Total Transactions: ${transactions.length}
    `);

    return transactions;
  } catch (error) {
    console.error(`
❌ Failed to Retrieve History:
⚠️ Error: ${error.message}
🔍 Stack Trace:
${error.stack}
    `);
    throw error;
  }
}

// Example usage
async function main() {
  try {
    console.log("🚀 Starting Tax Withdrawal Demo...");

    const withdrawAuthoritySecretKey = process.env.DISCORD_BOT_PRIVATE_KEY;
    console.log(
      "🚀 ~ main ~ withdrawAuthoritySecretKey:",
      withdrawAuthoritySecretKey
    );
    const tokenMint = "4Gq9ZZUrbB6z5PxzkPKucsnd6UmcoGpQkQD3KRjRFURV";
    const destinationAddress = "F19p9Mso9Pr8AcroN8ZcNxVMNqWfFa3rDN93tVvJddna";

    // Validate required parameters
    console.log("🔍 Validating configuration...");
    if (!withdrawAuthoritySecretKey || !tokenMint || !destinationAddress) {
      console.error(`
❌ Missing Required Environment Variables:
${!withdrawAuthoritySecretKey ? "❌" : "✅"} WITHDRAW_AUTHORITY_SECRET_KEY
${!tokenMint ? "❌" : "✅"} TOKEN_MINT
${!destinationAddress ? "❌" : "✅"} DESTINATION_ADDRESS
      `);
      process.exit(1);
    }
    console.log("✅ Configuration validated!");

    // Execute a tax withdrawal
    console.log("\n📝 Executing tax withdrawal...");
    const result = await executeTaxWithdrawal({
      withdrawAuthoritySecretKey,
      tokenMint,
      destinationAddress,
    });

    console.log("\n📊 Withdrawal Result:", JSON.stringify(result, null, 2));

    // Get withdrawal history
    console.log("\n📚 Fetching transaction history...");
    const history = await getTaxWithdrawalHistory({
      withdrawAuthoritySecretKey,
      limit: 5,
    });
    console.log("\n📜 Transaction History:", JSON.stringify(history, null, 2));

    console.log("\n🎉 Demo completed successfully!");
  } catch (error) {
    console.error(`
❌ Operation Failed:
⚠️ Error: ${error.message}
🔍 Stack Trace:
${error.stack}
    `);
  }
}

// Run the example if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  getWithdrawAuthorityBalance,
  executeTaxWithdrawal,
  getTaxWithdrawalHistory,
};
