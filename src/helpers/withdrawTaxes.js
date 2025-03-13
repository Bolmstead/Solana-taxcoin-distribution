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
const bs58 = require("bs58").default;
require("dotenv").config();

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

async function executeTaxWithdrawal(
  withdrawAuthoritySecretKey,
  tokenMintAddress
) {
  try {
    console.log(`
🚀 Initiating Tax Withdrawal:
👜 withdrawAuthoritySecretKey: ${withdrawAuthoritySecretKey}
💎 Token Mint: ${tokenMintAddress}
    `);

    const privateKeyBytes = bs58.decode(withdrawAuthoritySecretKey);
    const withdrawAuthorityKeyPair = Keypair.fromSecretKey(privateKeyBytes);
    console.log(
      `👛 Withdraw Authority Public Key: ${withdrawAuthorityKeyPair.publicKey.toString()}`
    );

    // Initialize withdraw authority and token mint
    console.log("🔐 Initializing withdraw authority...");

    console.log("🏦 Initializing token mint...");
    const tokenMint = new PublicKey(tokenMintAddress);
    console.log("🚀 ~ tokenMint:", tokenMint);

    // Convert destination address to PublicKey
    console.log("🎯 Processing destination address...");
    const destinationPublicKey = new PublicKey(
      withdrawAuthorityKeyPair.publicKey
    );
    console.log("🚀 ~ destinationPublicKey:", destinationPublicKey);

    // Get the associated token accounts
    console.log("📋 Deriving associated token accounts...");
    const sourceTokenAccount = await getAssociatedTokenAddress(
      tokenMint,
      withdrawAuthorityKeyPair.publicKey
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
      withdrawAuthorityKeyPair.publicKey,
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
      withdrawAuthorityKeyPair,
    ]);

    console.log(`
🎉 Tax Withdrawal Successful!
📝 Transaction Details:
🔗 Signature: ${signature}
💰 sourceBalance: ${sourceBalance} tokens
📤 From: ${withdrawAuthorityKeyPair.publicKey.toString()}
📥 To: ${destinationPublicKey.toString()}
⏰ Timestamp: ${new Date().toISOString()}
    `);

    // Return the transaction details
    return {
      signature,
      sourceBalance,
      source: withdrawAuthorityKeyPair.publicKey.toString(),
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

// Run the example if this script is executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  getWithdrawAuthorityBalance,
  executeTaxWithdrawal,
  getTaxWithdrawalHistory,
};
