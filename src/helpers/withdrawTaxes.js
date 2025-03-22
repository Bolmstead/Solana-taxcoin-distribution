const { PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");
const { executeTaxWithdrawal } = require("./executeWithdrawal");
const {
  distributorWallet,
  taxedTokenMintAddress,
  taxedTokenProgramID,
} = require("../config/solana");

async function withdrawTaxes() {
  try {
    console.log("🚀 Starting tax withdrawal process...");

    // Get the distributor's associated token account for the taxed token
    const distributorTokenAccount = await getAssociatedTokenAddress(
      taxedTokenMintAddress,
      distributorWallet.publicKey,
      false,
      taxedTokenProgramID
    );

    console.log(
      "📫 Distributor Token Account:",
      distributorTokenAccount.toString()
    );

    // Execute the withdrawal
    const result = await executeTaxWithdrawal(distributorTokenAccount);

    if (result.status === "success") {
      console.log("✅ Tax withdrawal completed successfully!");
      console.log("Transaction signature:", result.signature);
      return result;
    } else if (result.status === "No Accounts") {
      console.log("ℹ️ No accounts found with withheld taxes to withdraw");
      return result;
    }
  } catch (error) {
    console.error("❌ Error during tax withdrawal:", error.message);
    throw error;
  }
}

// Execute if running directly
if (require.main === module) {
  withdrawTaxes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  withdrawTaxes,
};
