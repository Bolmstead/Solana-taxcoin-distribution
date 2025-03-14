const {
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const {
  connection,
  distributorWallet,
  rewardsTokenMintAddress,
  distributorWalletRewardsTokenAccount,
  rewardsTokenProgramID,
} = require("../config/solana");
const {
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const bs58 = require("bs58");

/**
 * Send tokens from the distributor wallet to multiple recipients in a single transaction
 * @param {Object} recipients - Object containing recipient addresses as keys and their reward details as values
 * @param {number} balance - Current balance available for distribution
 * @returns {Promise<string>} - Transaction signature
 */
async function transferTokensToMultipleAddresses(recipients, balance) {
  try {
    const transaction = new Transaction();
    let totalrewardAmount = 0;

    let balanceTracker = Number(balance);
    console.log("💼 [Transfer] Initial balance available:", balanceTracker);

    // Get the distributor's token account
    const fromTokenAccount = distributorWalletRewardsTokenAccount;
    console.log(
      "🏦 [Transfer] Distributor token account:",
      fromTokenAccount.toString()
    );

    // Add transfer instructions for each recipient
    for (const recipientAddress in recipients) {
      console.log("\n👤 [Transfer] Processing recipient:", recipientAddress);

      const rewardAmount = recipients[recipientAddress].reward;
      console.log("💸 [Transfer] Attempting to send amount:", rewardAmount);

      if (rewardAmount > balanceTracker) {
        console.log("⚠️ [Transfer] Insufficient balance for recipient");
        continue;
      }
      if (rewardAmount < 1) {
        console.log("⚠️ [Transfer] Reward amount too small");
        continue;
      }

      balanceTracker -= rewardAmount;
      console.log(
        "💰 [Transfer] Remaining balance after transfer:",
        balanceTracker
      );

      // Get the recipient's associated token account
      const recipientPublicKey = new PublicKey(recipientAddress);
      console.log(
        "🔑 [Transfer] Recipient public key:",
        recipientPublicKey.toString()
      );
      console.log(
        "\n📝 [Transfer] Getting associated token address with params:"
      );
      console.log("├─ 🏦 Mint Address:", rewardsTokenMintAddress.toString());
      console.log("├─ 👤 Recipient Public Key:", recipientPublicKey.toString());
      console.log("├─ 🔄 Allow Owner Off Curve:", true);
      console.log("├─ 🔑 Token Program ID:", rewardsTokenProgramID.toString());
      console.log(
        "└─ 🔗 Associated Token Program ID:",
        ASSOCIATED_TOKEN_PROGRAM_ID.toString()
      );

      const associatedTokenAddress = await getAssociatedTokenAddress(
        rewardsTokenMintAddress,
        recipientPublicKey,
        true,
        rewardsTokenProgramID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      console.log(
        "🚀 ~ transferTokensToMultipleAddresses ~ associatedTokenAddress:",
        associatedTokenAddress
      );

      // Check if the token account exists
      let accountInfo;
      try {
        accountInfo = await connection.getAccountInfo(associatedTokenAddress);
        if (accountInfo === null) {
          throw new Error("Account does not exist");
        }
        console.log("✨ [Transfer] Recipient token account exists");
      } catch (error) {
        console.log("🛠️ [Transfer] Creating token account for recipient...");
        // Create ATA instruction
        console.log("📝 [Transfer] Creating ATA instruction...");
        console.log(
          "👨‍💼 [Transfer] Distributor public key:",
          distributorWallet.publicKey.toString()
        );

        const createAtaInstruction = createAssociatedTokenAccountInstruction(
          distributorWallet.publicKey, // payer
          associatedTokenAddress, // ata
          recipientPublicKey, // owner
          rewardsTokenMintAddress // mint
        );
        transaction.add(createAtaInstruction);
        console.log("✅ [Transfer] ATA creation instruction added");
      }

      // Create transfer instruction
      const transferInstruction = createTransferInstruction(
        fromTokenAccount,
        associatedTokenAddress,
        distributorWallet.publicKey,
        rewardAmount
      );
      console.log("📋 [Transfer] Transfer instruction created");

      transaction.add(transferInstruction);
      console.log("➕ [Transfer] Instruction added to transaction");

      totalrewardAmount += rewardAmount;
    }

    // If no instructions were added, no need to proceed
    if (transaction.instructions.length === 0) {
      console.log("ℹ️ [Transfer] No valid transfers to process");
      return null;
    }

    // Set a recent blockhash for the transaction
    transaction.recentBlockhash = (
      await connection.getLatestBlockhash()
    ).blockhash;
    console.log("🔒 [Transfer] Recent blockhash set");

    transaction.feePayer = distributorWallet.publicKey;
    console.log("💳 [Transfer] Fee payer set");

    // Send and confirm the transaction
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      distributorWallet,
    ]);

    console.log("\n🌟 [Transfer] Transaction successful!");
    console.log("📜 [Transfer] Signature:", signature);
    console.log("💫 [Transfer] Total tokens sent:", totalrewardAmount);
    console.log(
      "👥 [Transfer] Number of recipients:",
      Object.keys(recipients).length
    );

    return signature;
  } catch (error) {
    console.error("❌ [Transfer] Error during transfer:", error);
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
    const MAX_INSTRUCTIONS_PER_BATCH = 10; // Conservative limit to ensure we stay under size limit

    // Try adding recipients to the current batch until we hit the instruction limit
    for (const [address, details] of Object.entries(remainingRecipients)) {
      console.log("👤 Processing recipient:", address);
      console.log("📋 Details:", details);
      console.log("🔢 Instruction count:", instructionCount);
      console.log("⚖️ MAX INSTRUCTIONS PER BATCH:", MAX_INSTRUCTIONS_PER_BATCH);
      if (instructionCount >= MAX_INSTRUCTIONS_PER_BATCH) {
        console.log("⚠️ Batch instruction limit reached");
        break;
      }

      currentBatch[address] = details;
      instructionCount++;

      // Remove this recipient from the remaining set
      delete remainingRecipients[address];
    }

    const batchSize = Object.keys(currentBatch).length;
    console.log("\n📤 Processing current batch:");
    console.log("├─ 📊 Recipients in batch:", batchSize);
    console.log("├─ 📈 Total processed so far:", processedCount);
    console.log(
      "└─ 📉 Remaining after this batch:",
      Object.keys(remainingRecipients).length
    );

    try {
      console.log("🔄 Transferring tokens to multiple addresses...");
      console.log("📦 Current batch:", currentBatch);
      console.log("💰 Balance:", balance);
      const signature = await transferTokensToMultipleAddresses(
        currentBatch,
        balance
      );
      if (signature) {
        allSignatures.push(signature);
        processedCount += batchSize;
        console.log("\n✅ Batch completed successfully");
        console.log("├─ 📝 Signature:", signature);
        console.log(
          "├─ 📊 Progress:",
          `${processedCount}/${Object.keys(recipients).length}`
        );
        console.log(
          "└─ 📈 Completion:",
          `${((processedCount / Object.keys(recipients).length) * 100).toFixed(
            2
          )}%`
        );
      }
    } catch (error) {
      console.error("\n❌ Batch Transfer Error:");
      console.error("├─ 🔢 Batch number:", batchNumber);
      console.error("├─ 👥 Recipients in failed batch:", batchSize);
      console.error("└─ ⚠️ Error:", error.message);
      throw error;
    }

    // Small delay between batches to avoid rate limiting
    console.log("\n⏳ Waiting 1 second before next batch...");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    batchNumber++;
  }

  console.log("🫣 All signatures:", allSignatures);

  console.log("\n=== 🎉 BATCH TRANSFER SUMMARY ===");
  console.log("✅ Status: All batches completed successfully");
  console.log("📊 Total statistics:");
  console.log("├─ 📦 Total batches processed:", allSignatures.length);
  console.log("├─ 👥 Total recipients processed:", processedCount);
  console.log(
    "├─ 📈 Average recipients per batch:",
    (processedCount / allSignatures.length).toFixed(2)
  );
  console.log("└─ 📜 All transaction signatures:");
  allSignatures.forEach((sig, index) => {
    console.log(`   ├─ 🔖 Batch ${index + 1}: ${sig}`);
  });
  console.log("===============================");

  return allSignatures;
}

module.exports = { transferTokensToMultipleAddresses, batchTransferTokens };

// Example usage when run directly
if (require.main === module) {
  const execute = async () => {
    try {
      console.log("\n=== 🧪 TEST TRANSFER EXECUTION ===");

      // Example recipients with test data
      const testRecipients = {
        HnC8ETqqR6cC6FGnBE5ANdajAss9WYFLFMC2RxnXxeUZ: {
          currentHoldings: 15293.927308,
          reward: 62,
          percentage: 0.000015293927308,
        },

        "92vZwgTSqtqSJqVwUqaCUFM5JRwaxBAvHbcEUnoXm8EB": {
          currentHoldings: 92709.696389,
          reward: 378,
          percentage: 0.000092709696389,
        },
      };

      // Test balance - this would normally come from checking actual balance
      const testBalance = 10000;

      // Test single transfer
      console.log("\n📝 Testing single transfer...");
      // try {
      //   const singleTransferResult = await transferTokensToMultipleAddresses(
      //     {
      //       [Object.keys(testRecipients)[0]]:
      //         testRecipients[Object.keys(testRecipients)[0]],
      //     },
      //     testBalance
      //   );
      //   console.log("✅ Single transfer test result:", singleTransferResult);
      // } catch (error) {
      //   console.error("❌ Single transfer test failed:", error.message);
      // }

      // Test batch transfer
      console.log("\n📦 Testing batch transfer...");
      try {
        const batchTransferResult = await batchTransferTokens(
          testRecipients,
          testBalance
        );
        console.log("✅ Batch transfer test result:", batchTransferResult);
      } catch (error) {
        console.error("❌ Batch transfer test failed:", error.message);
      }

      console.log("\n=== 🎉 TEST EXECUTION COMPLETE ===");
    } catch (error) {
      console.error("❌ Test execution error:", error);
    }
  };

  execute().catch(console.error);
}
