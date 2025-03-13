const { getAssociatedTokenAddress } = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  taxedTokenKeypair,
  rewardsTokenKeypair,
} = require("../config/solana");

// Initialize token accounts
async function initializeTokenAccounts() {
  try {
    // Distributor wallet Taxed token account
    const distributorWalletTaxedTokenAccount = await getAssociatedTokenAddress(
      taxedTokenKeypair,
      distributorWallet.publicKey
    );

    console.log(
      "Token account for wallet distributorWalletTaxedTokenAccount",
      distributorWalletTaxedTokenAccount
    );

    // Distributor wallet Rewards token account
    const distributorWalletRewardsTokenAccount =
      await getAssociatedTokenAddress(
        rewardsTokenKeypair,
        distributorWallet.publicKey
      );
    console.log(
      "Token account for wallet distributorWalletRewardsTokenAccount",
      distributorWalletRewardsTokenAccount
    );

    return {
      distributorWalletTaxedTokenAccount,
      distributorWalletRewardsTokenAccount,
    };
  } catch (error) {
    console.error("Error initializing token accounts:", error.message);
    throw error;
  }
}

module.exports = { initializeTokenAccounts };
