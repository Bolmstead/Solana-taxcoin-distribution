const {
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getLatestBlockhash,
} = require("@solana/web3.js");
const {
  connection,
  distributorWallet,
  tokenMint,
  DECIMALS,
  DISTRIBUTING_REWARDS_TOKEN_ACCOUNT,
  MAX_TRANSACTION_SIZE,
} = require("../config/solana");
const { createTransferInstruction } = require("@solana/spl-token");
const bs58 = require("bs58");

/**
 * Send Solana from one wallet to multiple recipients in a single transaction
 * @param {string} fromPrivateKey - The private key of the sender wallet (bs58 encoded string)
 * @param {Array<{address: string, amountInSOL: number}>} recipients - Array of recipient objects with address and amount
 * @returns {Promise<string>} - Transaction signature
 */
async function transferTokensToMultipleAddresses(recipients, balance) {
  try {
    const transaction = new Transaction();
    let totalrewardAmount = 0;

    let balanceTracker = Number(balance);
    console.log("[Transfer] Initial balance available:", balanceTracker);

    // Add transfer instructions for each recipient
    for (const recipientAddress in recipients) {
      console.log("\n[Transfer] Processing recipient:", recipientAddress);

      const rewardAmount = recipients[recipientAddress].reward;
      console.log("[Transfer] Attempting to send amount:", rewardAmount);

      if (rewardAmount > balanceTracker) {
        console.log("[Transfer] ⚠️ Insufficient balance for recipient");
        continue;
      }
      if (rewardAmount < 1) {
        console.log("[Transfer] ⚠️ Reward amount too small");
        continue;
      }

      balanceTracker -= rewardAmount;
      console.log(
        "[Transfer] Remaining balance after transfer:",
        balanceTracker
      );

      const toTokenAccount = new PublicKey(
        recipients[recipientAddress].tokenAccount
      );
      console.log(
        "[Transfer] Recipient token account:",
        toTokenAccount.toString()
      );

      const fromTokenAccount = new PublicKey(
        DISTRIBUTING_REWARDS_TOKEN_ACCOUNT
      );
      console.log(
        "[Transfer] Sender token account:",
        fromTokenAccount.toString()
      );

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        distributorWallet.publicKey,
        rewardAmount
      );
      console.log("[Transfer] ✓ Transfer instruction created");

      transaction.add(transferInstruction);
      console.log("[Transfer] ✓ Instruction added to transaction");

      totalrewardAmount += rewardAmount;
    }

    // Set a recent blockhash for the transaction
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    console.log("[Transfer] ✓ Recent blockhash set");

    transaction.feePayer = distributorWallet.publicKey;
    console.log("[Transfer] ✓ Fee payer set");

    // Send and confirm the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      distributorWallet,
    ]);

    console.log("\n[Transfer] 🎉 Transaction successful!");
    console.log("[Transfer] Signature:", signature);
    console.log("[Transfer] Total tokens sent:", totalrewardAmount);
    console.log(
      "[Transfer] Number of recipients:",
      Object.keys(recipients).length
    );

    return signature;
  } catch (error) {
    console.error("[Transfer] ❌ Error during transfer:", error);
    throw error;
  }
}

async function batchTransferTokens(recipients, balance) {
  console.log("\n=== 🚀 BATCH TRANSFER INITIALIZATION ===");
  console.log(
    "📊 Total recipients to process:",
    Object.keys(recipients).length
  );
  console.log("💰 Total balance available:", balance);
  console.log("=======================================\n");

  let remainingRecipients = { ...recipients };
  let currentBatch = {};
  let allSignatures = [];
  let processedCount = 0;
  let batchNumber = 1;

  while (Object.keys(remainingRecipients).length > 0) {
    console.log(`\n=== 📦 BATCH #${batchNumber} ===`);
    console.log(
      "🔄 Recipients remaining:",
      Object.keys(remainingRecipients).length
    );

    currentBatch = {};
    let instructionCount = 0;
    const MAX_INSTRUCTIONS_PER_BATCH = 20; // Conservative limit to ensure we stay under size limit

    // Try adding recipients to the current batch until we hit the instruction limit
    for (const [address, details] of Object.entries(remainingRecipients)) {
      if (instructionCount >= MAX_INSTRUCTIONS_PER_BATCH) {
        console.log("⚠️  Batch instruction limit reached");
        break;
      }

      currentBatch[address] = details;
      instructionCount++;

      // Remove this recipient from the remaining set
      delete remainingRecipients[address];
    }

    const batchSize = Object.keys(currentBatch).length;
    console.log("\n📤 Processing current batch:");
    console.log("├─ Recipients in batch:", batchSize);
    console.log("├─ Total processed so far:", processedCount);
    console.log(
      "└─ Remaining after this batch:",
      Object.keys(remainingRecipients).length
    );

    try {
      const signature = await transferTokensToMultipleAddresses(
        currentBatch,
        balance
      );
      if (signature) {
        allSignatures.push(signature);
        processedCount += batchSize;
        console.log("\n✅ Batch completed successfully");
        console.log("├─ Signature:", signature);
        console.log(
          "├─ Progress:",
          `${processedCount}/${Object.keys(recipients).length}`
        );
        console.log(
          "└─ Completion:",
          `${((processedCount / Object.keys(recipients).length) * 100).toFixed(
            2
          )}%`
        );
      }
    } catch (error) {
      console.error("\n❌ Batch Transfer Error:");
      console.error("├─ Batch number:", batchNumber);
      console.error("├─ Recipients in failed batch:", batchSize);
      console.error("└─ Error:", error.message);
      throw error;
    }

    // Small delay between batches to avoid rate limiting
    console.log("\n⏳ Waiting 1 second before next batch...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    batchNumber++;
  }

  console.log("\n=== 🎉 BATCH TRANSFER SUMMARY ===");
  console.log("✅ Status: All batches completed successfully");
  console.log("📊 Total statistics:");
  console.log("├─ Total batches processed:", allSignatures.length);
  console.log("├─ Total recipients processed:", processedCount);
  console.log(
    "├─ Average recipients per batch:",
    (processedCount / allSignatures.length).toFixed(2)
  );
  console.log("└─ All transaction signatures:");
  allSignatures.forEach((sig, index) => {
    console.log(`   ├─ Batch ${index + 1}: ${sig}`);
  });
  console.log("===============================");

  return allSignatures;
}

// Example usage:
// async function main() {
//   // Replace these values with your actual wallet details

//   // Example of multiple recipients
//   const recipients = {
//     [process.env.BURNER_WALLET_PUBLIC_KEY]: {
//       reward: 123,
//       tokenAccount: process.env.BURNER_WALLET_JUP_TOKEN_ACCOUNT,
//     },
//     [process.env.DEGEN_WALLET_PUBLIC_KEY]: {
//       reward: 321,
//       tokenAccount: process.env.DEGEN_WALLET_JUP_TOKEN_ACCOUNT,
//     },
//   };

//   try {
//     const signature = await transferTokensToMultipleAddresses(
//       process.env.JUP_TOKEN_ADDRESS,
//       recipients
//     );
//     console.log(
//       `Transaction link: https://explorer.solana.com/tx/${signature}`
//     );

//     // Example of single recipient transfer using the multi-recipient function
//     // const singleRecipientSignature = await transferSOL(fromPrivateKey, 'ACqmGpAW5B6Ev8NgieiL8KBFQvLs9fWpAQsAiKbmS8Ha', 0.1);
//     // console.log(`Single transaction link: https://explorer.solana.com/tx/${singleRecipientSignature}?cluster=devnet`);
//   } catch (error) {
//     console.error("Transfer failed:", error);
//   }
// }

// Run the example

module.exports = { transferTokensToMultipleAddresses, batchTransferTokens };
