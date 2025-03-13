const { PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAccount } = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  distributorWalletRewardsTokenAccount,
} = require("../config/solana");

async function checkBalance(publicKeyString, tokenAccountString) {
  console.log("Checking token balance...");

  try {
    const publicKey = new PublicKey(publicKeyString);
    console.log("🚀 ~ checkBalance ~ publicKey:", publicKey.toString());

    // Get the token account info
    const tokenAccountPublicKey = new PublicKey(tokenAccountString);
    console.log(
      "🚀 ~ checkBalance ~ tokenAccountPublicKey:",
      tokenAccountPublicKey
    );

    const tokenAccountInfo = await getAccount(
      connection,
      tokenAccountPublicKey
    );
    console.log("🚀 ~ checkBalance ~ tokenAccountInfo:", tokenAccountInfo);

    const balance = Number(tokenAccountInfo.amount);

    return balance;
  } catch (error) {
    console.error("Error checking token balance:", error);
    return 0;
  }
}

// Only run if this file is run directly
if (require.main === module) {
  // You need to provide a wallet address as an argument

  checkBalance(
    distributorWallet.publicKey.toString(),
    distributorWalletRewardsTokenAccount.toString()
  ).then(
    () => process.exit(0),
    (err) => {
      console.error(err);
      process.exit(1);
    }
  );
}

module.exports = { checkBalance };
