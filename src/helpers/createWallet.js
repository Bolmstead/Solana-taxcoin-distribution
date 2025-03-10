const { Keypair } = require("@solana/web3.js");
const bs58 = require("bs58").default;

function createNewWallet() {
  try {
    // Generate a new keypair
    const newWallet = Keypair.generate();

    // Get the public key (as base58 string)
    const publicKey = newWallet.publicKey.toBase58();

    // Get the private key (as base58 string)
    const privateKey = bs58.encode(newWallet.secretKey);

    console.log("\n=== 🎉 New Wallet Created Successfully ===");
    console.log("🔑 Public Key:", publicKey);
    console.log("🔐 Private Key:", privateKey);
    console.log("=======================================\n");

    return {
      publicKey,
      privateKey,
    };
  } catch (error) {
    console.error("❌ Error creating wallet:", error.message);
    throw error;
  }
}

// Only run if this file is run directly
if (require.main === module) {
  createNewWallet();
}

module.exports = { createNewWallet };
