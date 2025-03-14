const { PublicKey } = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} = require("@solana/spl-token");
const {
  connection,
  taxedTokenMintAddress,
  rewardsTokenMintAddress,
  taxedTokenProgramID,
  rewardsTokenProgramID,
  distributorWallet,
  distributorWalletTaxedTokenAccount,
  distributorWalletRewardsTokenAccount,
} = require("../config/solana");

/**
 * Tests getting the associated token address for a wallet and token mint
 * @param {string} walletAddress - The wallet address to check
 * @param {string} mintAddress - The mint (token) address
 * @param {string} [programId] - Optional program ID (defaults to TOKEN_PROGRAM_ID)
 * @returns {Promise<Object>} - Associated token address information or error details
 */
async function testGetAssociatedTokenAddress(
  walletAddress,
  mintAddress,
  programId = TOKEN_PROGRAM_ID
) {
  try {
    console.log("\n🔍 [Test Get Associated Token Address] Starting check...");
    console.log("👤 Wallet Address:", walletAddress);
    console.log("🏦 Mint Address:", mintAddress);
    console.log("🔑 Program ID:", programId.toString());

    const walletPubKey = new PublicKey(walletAddress);
    const mintPubKey = new PublicKey(mintAddress);

    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintPubKey,
      walletPubKey,
      false,
      programId,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    console.log("\n✅ [Test Get Associated Token Address] Address found!");
    console.log("Associated Token Account details:");
    console.log("├─ 📬 Address:", associatedTokenAddress.toString());
    console.log("├─ 👤 Owner:", walletAddress);
    console.log("└─ 🏦 Mint:", mintAddress);

    return {
      success: true,
      associatedTokenAddress: associatedTokenAddress.toString(),
      owner: walletAddress,
      mint: mintAddress,
    };
  } catch (error) {
    console.error("\n❌ [Test Get Associated Token Address] Error:");
    console.error("├─ 👤 Wallet:", walletAddress);
    console.error("├─ 🏦 Mint:", mintAddress);
    console.error("└─ ⚠️ Error:", error);

    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = { testGetAssociatedTokenAddress };

// Example usage if run directly
if (require.main === module) {
  const execute = async () => {
    // Example usage - replace with actual addresses to test
    const walletAddress = distributorWallet.publicKey.toString();
    // You'll need to provide a mint address to test with
    const mintAddress = taxedTokenMintAddress; // Replace this with an actual mint address

    console.log("🏦 Testing for wallet:", walletAddress);
    const result = await testGetAssociatedTokenAddress(
      walletAddress,
      mintAddress,
      TOKEN_2022_PROGRAM_ID
    );
    console.log("\n📋 Test Result:", result);
  };

  execute().catch(console.error);
}
