const { Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const {
  getOrCreateAssociatedTokenAccount,
  createTransferInstruction,
} = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  tokenMint,
} = require("../config/solana");
const { getTokenHolders } = require("./tokenHolders");

async function distributeTokens() {
  try {
    console.log("Starting token distribution...");

    // Get all token holders
    const holders = await getTokenHolders();
    console.log(`Found ${holders.length} token holders`);
    console.log("🚀 ~ distributeTokens ~ holders:", holders);

    // Get distributor's token account
    const distributorTokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      distributorWallet,
      tokenMint,
      distributorWallet.publicKey
    );

    const distributionAmount = BigInt(process.env.DISTRIBUTION_AMOUNT);

    // Process each holder
    for (const holderAddress of holders) {
      try {
        // Skip if holder is the distributor
        if (holderAddress.equals(distributorWallet.publicKey)) {
          continue;
        }

        // Get or create holder's token account
        const holderTokenAccount = await getOrCreateAssociatedTokenAccount(
          connection,
          distributorWallet,
          tokenMint,
          holderAddress
        );

        // Create transfer instruction
        const transferIx = createTransferInstruction(
          distributorTokenAccount.address,
          holderTokenAccount.address,
          distributorWallet.publicKey,
          distributionAmount
        );

        // Create and send transaction
        const transaction = new Transaction().add(transferIx);
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [distributorWallet]
        );

        console.log(
          `Sent ${distributionAmount} tokens to ${holderAddress.toBase58()}`
        );
        console.log(`Transaction: ${signature}`);
      } catch (error) {
        console.error(
          `Error processing holder ${holderAddress.toBase58()}:`,
          error
        );
        continue;
      }
    }

    console.log("Distribution complete!");
  } catch (error) {
    console.error("Error in distribution process:", error);
  }
}

module.exports = {
  distributeTokens,
};
