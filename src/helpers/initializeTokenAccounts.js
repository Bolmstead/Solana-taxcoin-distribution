const { getAssociatedTokenAddress } = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  taxedTokenMintAddress,
  rewardsTokenMintAddress,
} = require("../config/solana");

// Initialize token accounts
async function initializeTokenAccounts() {
  try {
    // Distributor wallet Taxed token account
    const distributorWalletTaxedTokenAccount = await getAssociatedTokenAddress(
      taxedTokenMintAddress,
      distributorWallet.publicKey
    );

    console.log(
      "👾 Token account for wallet distributorWalletTaxedTokenAccount",
      distributorWalletTaxedTokenAccount
    );
    console.log(
      "👾 Token account for wallet distributorWalletTaxedTokenAccount.toString()",
      distributorWalletTaxedTokenAccount.toString()
    );

    // Distributor wallet Rewards token account
    const distributorWalletRewardsTokenAccount =
      await getAssociatedTokenAddress(
        rewardsTokenMintAddress,
        distributorWallet.publicKey
      );
    console.log(
      "🪖 Token account for wallet distributorWalletRewardsTokenAccount",
      distributorWalletRewardsTokenAccount
    );
    console.log(
      "🪖 Token account for wallet distributorWalletRewardsTokenAccount.toString()",
      distributorWalletRewardsTokenAccount.toString()
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
