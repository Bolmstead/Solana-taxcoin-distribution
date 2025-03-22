const { PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");

const {
  connection,
  distributorWallet,
  distributorWalletRewardsTokenAccount,
} = require("../config/solana");

async function requestAirdrop() {
  try {
    console.log(
      "🚀 Requesting airdrop for wallet:",
      distributorWallet.publicKey.toString()
    );

    const signature = await connection.requestAirdrop(
      distributorWallet.publicKey,
      LAMPORTS_PER_SOL
    );

    console.log("⏳ Confirming transaction...");
    await connection.confirmTransaction({ signature });
    console.log("✅ Airdrop successful! Transaction signature:", signature);

    return {
      success: true,
      signature,
    };
  } catch (error) {
    console.error("❌ Error requesting airdrop:", error.message);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
    return {
      success: false,
      error: error.message,
    };
  }
}

// Execute if running directly
if (require.main === module) {
  requestAirdrop()
    .then((result) => {
      if (result.success) {
        console.log("✨ Airdrop completed successfully!");
      } else {
        console.error("❌ Airdrop failed:", result.error);
      }
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("❌ Fatal error:", error);
      process.exit(1);
    });
}

module.exports = { requestAirdrop };
