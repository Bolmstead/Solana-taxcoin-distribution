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

async function checkBalance(accountPublicKey) {
  console.log("💰 Checking token balance...");

  // Handle both PublicKey objects and string addresses
  let tokenAccountPublicKey;
  console.log("🔍 Checking account public key type...");
  if (accountPublicKey instanceof PublicKey) {
    console.log("✅ Account is already a PublicKey instance");
    tokenAccountPublicKey = accountPublicKey;
  } else {
    console.log("🔄 Converting string to PublicKey...");
    try {
      tokenAccountPublicKey = new PublicKey(accountPublicKey);
      console.log("✅ Successfully converted to PublicKey");
    } catch (error) {
      console.error("❌ Invalid account public key:", error);
      return 0;
    }
  }

  console.log("👛 Token Account Public Key:", tokenAccountPublicKey.toString());

  try {
    console.log("🥦 TOKEN_2022_PROGRAM_ID:: ", TOKEN_2022_PROGRAM_ID);
    const accountInfo = await connection.getAccountInfo(tokenAccountPublicKey);
    console.log("🍇 accountInfo:: ", accountInfo);
    console.log("🍇 Actual account owner:", accountInfo?.owner.toString());
    const tokenAccountInfo = await getAccount(
      connection,
      tokenAccountPublicKey,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    console.log("📊 Token Account Info:", tokenAccountInfo);

    const balance = Number(tokenAccountInfo.amount);
    console.log("💎 Current Balance:", balance);

    return balance;
  } catch (error) {
    if (error.name === "TokenInvalidAccountOwnerError") {
      console.error(
        "❌ Token account exists but is not owned by the expected owner"
      );
    } else if (error.name === "TokenAccountNotFoundError") {
      console.error("❌ Token account does not exist");
    } else {
      console.error("❌ Error checking token balance:", error);
    }
    return 0;
  }
}

module.exports = { checkBalance };
