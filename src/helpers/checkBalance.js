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

async function checkBalance(accountPublicKey, tokenProgram) {
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
    console.log("🥦 tokenProgram:: ", tokenProgram);
    const accountInfo = await connection.getAccountInfo(tokenAccountPublicKey);
    console.log("🍇 accountInfo:: ", accountInfo);
    console.log("🍇 Actual account owner:", accountInfo?.owner.toString());
    const tokenAccountInfo = await getAccount(
      connection,
      tokenAccountPublicKey,
      "confirmed",
      tokenProgram
    );

    console.log(
      "✅ checkBalance Worked! Token Account Info:",
      tokenAccountInfo
    );

    const balance = Number(tokenAccountInfo.amount);
    console.log("💎 Current Balance:", balance);

    return balance;
  } catch (error) {
    if (error.name === "TokenInvalidAccountOwnerError") {
      console.error("❌ Token Program Didn't work 🤷🏾‍♀️");
      console.log(error);
    } else if (error.name === "TokenAccountNotFoundError") {
      console.error("❌ Token account does not exist");
      return "error";
    } else {
      console.error("❌ Error checking token balance:", error);
      return "error";
    }
  }
}

module.exports = { checkBalance };
