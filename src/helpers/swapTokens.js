const { PublicKey } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, getAccount } = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  DISTRIBUTING_REWARDS_TOKEN_ACCOUNT,
  jupiter,
} = require("../config/solana");
const { checkBalance } = require("./checkBalance");

/**
 * Swaps all tokens from the distributor wallet into a target memecoin
 * @param {string} targetTokenMint - The public key of the target token to swap into
 * @returns {Promise<string>} - Transaction signature
 */
async function swapDistributorTokens(fromTokenMint, targetTokenMint) {
  try {
    console.log("\n=== 🔄 INITIATING TOKEN SWAP ===");

    // Get current balance of distributor wallet
    const currentBalance = await checkBalance(
      distributorWallet.publicKey.toString(),
      fromTokenMint
    );

    if (!currentBalance || currentBalance <= 0) {
      throw new Error("No tokens available to swap");
    }

    console.log(`💰 Current balance to swap: ${currentBalance}`);

    // Get routes
    const routes = await jupiter.computeRoutes({
      inputMint: new PublicKey(DISTRIBUTING_REWARDS_TOKEN_ACCOUNT), // token we're swapping from
      outputMint: new PublicKey(targetTokenMint), // token we're swapping to
      amount: currentBalance, // raw amount, not normalized
      slippageBps: 50, // 0.5% slippage
    });

    if (!routes.routesInfos || routes.routesInfos.length === 0) {
      throw new Error("No routes found for swap");
    }

    // Select best route
    const bestRoute = routes.routesInfos[0];
    console.log(`📊 Expected output amount: ${bestRoute.outAmount}`);
    console.log(`📉 Price impact: ${bestRoute.priceImpactPct}%`);

    // Execute swap
    const { execute } = await jupiter.exchange({
      routeInfo: bestRoute,
    });

    const swapResult = await execute();

    if ("error" in swapResult) {
      throw new Error(`Swap failed: ${swapResult.error}`);
    }

    console.log("\n✅ Swap completed successfully!");
    console.log(`📝 Transaction signature: ${swapResult.txid}`);
    console.log("===============================\n");

    return swapResult.txid;
  } catch (error) {
    console.error("\n❌ Swap Error:", error.message);
    throw error;
  }
}

// Example usage when run directly
if (require.main === module) {
  const toTokenMint = TARGET_MEME_COIN_ADDRESS;
  if (!toTokenMint) {
    console.error("Please provide a target token mint address");
    process.exit(1);
  }

  swapDistributorTokens(DISTRIBUTING_REWARDS_TOKEN_ACCOUNT, toTokenMint)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { swapDistributorTokens };
