const { createJupiterApiClient } = require("@jup-ag/api");
const {
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  PublicKey,
} = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddress,
  getMint,
} = require("@solana/spl-token");
const bs58 = require("bs58");
const {
  transactionSenderAndConfirmationWaiter,
} = require("./utils/transactionSender.js");
const { getSignature } = require("./utils/getSignature.js");
const dotenv = require("dotenv");
const { heliusConnection, jupiterAPI } = require("../config/solana.js");
const { checkBalance } = require("../helpers/checkBalance.js");

dotenv.config();

// If you have problem landing transactions, read this: https://station.jup.ag/docs/swap-api/send-swap-transaction#how-jupiter-estimates-priority-fee

// Make sure that you are using your own RPC endpoint.
// Helius and Triton have staked SOL and they can usually land transactions better.

const jupiterAPI = createJupiterApiClient();

// --------- config ---------

const DEFAULT_AMOUNT_TO_BUY = null;

async function getQuote(inputMint, outputMint, amount, slippageBps) {
  console.log(`
🔍 Getting Quote:
📥 Input Token: ${inputMint}
📤 Output Token: ${outputMint}
💰 Amount: ${amount}
🎯 Slippage: ${slippageBps} bps
  `);

  // get quote
  const quote = await jupiterAPI.quoteGet({
    inputMint,
    outputMint,
    amount,
    slippageBps,
  });
  console.log(`📊 Quote Details:`, JSON.stringify(quote, null, 2));
  if (!quote) {
    throw new Error("❌ Unable to get quote");
  }
  return quote;
}

async function getSwapResponse(wallet, quote) {
  // Get serialized transaction
  const swapResponse = await jupiterAPI.swapPost({
    swapRequest: {
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toString(),
      dynamicComputeUnitLimit: true,
      dynamicSlippage: true,
      prioritizationFeeLamports: {
        priorityLevelWithMaxLamports: {
          maxLamports: 10000000,
          priorityLevel: "veryHigh", // If you want to land transaction fast, set this to use `veryHigh`. You will pay on average higher priority fee.
        },
      },
    },
  });
  return swapResponse;
}

async function swapAllTokens(
  walletKeypair,
  inputMint,
  outputMint,
  slippageBps = 2000,
  priorityFee = 0.05
) {
  console.log(`
🔄 Initiating Token Swap:
👛 Wallet: ${walletKeypair.publicKey.toString()}
📥 Input Token: ${inputMint}
📤 Output Token: ${outputMint}
🎯 Slippage: ${slippageBps} bps
💸 Priority Fee: ${priorityFee} SOL
  `);

  // Early validation to prevent unnecessary processing
  if (!outputMint || !inputMint || !walletSecretKey) {
    console.error("❌ Missing required parameters for swapAllTokens");
    return null;
  }
  if (slippageBps > 10000) {
    console.error("⚠️ Slippage bps too high (max: 10000)");
    return null;
  }

  const amountToBuyLamports = amountToBuy * LAMPORTS_PER_SOL;

  try {
    if (!walletKeypair) {
      console.error("❌ Wallet not found");
      return null;
    }

    const balance = await getTokenBalance(inputMint, walletKeypair);
    console.log(`💰 Current Token Balance:`, balance);

    // Get quote and prepare swap
    const quote = await getQuote(inputMint, outputMint, balance, slippageBps);
    console.log(`📈 Swap Quote Received:`, JSON.stringify(quote, null, 2));

    if (!quote) {
      console.error("❌ Failed to get quote");
      return null;
    }

    return;

    const swapResponse = await getSwapResponse(walletKeypair, quote);
    if (!swapResponse) {
      console.error("Failed to get swap response");
      return null;
    }

    // Prepare transaction (reuse Buffer to avoid extra allocation)
    const transactionBuffer = Buffer.from(
      swapResponse.swapTransaction,
      "base64"
    );
    const transaction = VersionedTransaction.deserialize(
      Uint8Array.from(transactionBuffer)
    );

    // Just sign and send
    transaction.sign([walletKeypair]);
    const signature = getSignature(transaction);
    const serializedTx = transaction.serialize();

    const txResponse = await transactionSenderAndConfirmationWaiter({
      connection: heliusConnection,
      serializedTransaction: Buffer.from(serializedTx),
      blockhashWithExpiryBlockHeight: {
        blockhash: transaction.message.recentBlockhash,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight,
      },
    });

    // Check transaction result
    if (!txResponse) {
      console.error("Transaction not confirmed");
      return null;
    }

    if (txResponse.meta?.err) {
      console.error("Transaction error:", txResponse.meta.err);
      return null;
    }

    console.log(
      `✅ Transaction successful: https://solscan.io/tx/${signature}`
    );
    return true;
  } catch (error) {
    console.error("Swap execution failed:", error);
    return null;
  }
}

async function getTokenBalance(tokenMint, keyPair) {
  try {
    console.log(`🔍 Checking balance for token: ${tokenMint}`);
    // Convert token mint string to PublicKey
    const mintPubkey = new PublicKey(tokenMint);

    // Get the associated token account address
    const tokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      keyPair.publicKey
    );

    try {
      const account = await getAccount(heliusConnection, tokenAccount);
      console.log(
        `📋 Token Account Details:`,
        JSON.stringify(account, null, 2)
      );

      // Get mint info to get decimals
      const mintInfo = await getMint(heliusConnection, mintPubkey);
      console.log(`ℹ️ Token Mint Info:`, JSON.stringify(mintInfo, null, 2));
      const decimals = mintInfo.decimals;
      console.log(`🔢 Token Decimals: ${decimals}`);

      return {
        success: true,
        balance: Number(account.amount),
        decimals: decimals,
        formattedBalance: Number(account.amount) / Math.pow(10, decimals),
      };
    } catch (error) {
      if (error.message.includes("Account does not exist")) {
        return {
          success: true,
          balance: 0,
          decimals: 0,
          formattedBalance: 0,
        };
      }
      throw error;
    }
  } catch (error) {
    console.error("Error getting token balance:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function sellTokenPercent(
  walletName,
  memeTokenAddress,
  percentToSell = 100,
  amountToSell
) {
  console.log(`
🚀 Initiating Token Sale:
👤 Wallet Name: ${walletName}
🎯 Token Address: ${memeTokenAddress}
📊 Percentage to Sell: ${percentToSell}%
  `);

  let wallet = null;
  if (walletName === "Berkley") {
    wallet = Keypair.fromSecretKey(
      bs58.decode(process.env.TEST_WALLET_PRIVATE_KEY || "")
    );
  } else if (walletName === "Sharif") {
    wallet = Keypair.fromSecretKey(
      bs58.decode(process.env.SHARIF_WALLET_PRIVATE_KEY || "")
    );
  }

  console.log(`👛 Active Wallet: ${wallet.publicKey.toString()}`);

  // Convert the input token address to a PublicKey
  const memeTokenPublicKey = new PublicKey(memeTokenAddress);
  console.log(`🔑 Token PublicKey: ${memeTokenPublicKey.toString()}`);

  const solanaAddress = new PublicKey(
    "So11111111111111111111111111111111111111112"
  );
  console.log(`💎 Target SOL Address: ${solanaAddress.toString()}`);

  try {
    console.log(`🔍 Fetching Associated Token Account...`);
    const userTokenAccount = await getAssociatedTokenAddress(
      memeTokenPublicKey,
      wallet.publicKey
    );
    console.log(`📂 Token Account Found: ${userTokenAccount.toString()}`);

    console.log(`💰 Checking Current Balance...`);
    const tokenBalance = await heliusConnection.getTokenAccountBalance(
      userTokenAccount
    );
    let { amount, decimals, uiAmount } = tokenBalance.value;

    amount = Number(amount);

    if (!amountToSell) {
      console.log(`
📊 Token Balance Details:
💰 Raw Amount: ${amount}
🔢 Decimals: ${decimals}
💎 UI Amount: ${uiAmount}
      `);

      if (!amount || amount <= 0) {
        console.error(`❌ No tokens found for address: ${memeTokenAddress}`);
        throw new Error(`No tokens found for ${memeTokenAddress}`);
      }

      // Calculate the amount to sell based on percentage
      amountToSell = (amount * percentToSell) / 100;
      console.log(`
✨ Sale Calculation:
💰 Total Tokens: ${amount}
📊 Selling: ${amountToSell} tokens (${percentToSell}%)
      `);
    }
    // Get quote using the API client
    console.log("🔍 Getting quote...");
    const quote = await getQuote(
      memeTokenPublicKey.toString(),
      solanaAddress.toString(),
      Math.floor(amountToSell), // Convert percentage to raw amount
      500
    );
    console.log("✅ Quote received:", quote);

    // Get swap response
    console.log("🔄 Getting swap response...");
    const swapResponse = await getSwapResponse(wallet, quote);
    console.log("✅ Swap response received");

    // Prepare and send transaction
    console.log("⚡ Preparing transaction...");
    const transactionBuffer = Buffer.from(
      swapResponse.swapTransaction,
      "base64"
    );
    const transaction = VersionedTransaction.deserialize(
      Uint8Array.from(transactionBuffer)
    );

    console.log("✍️ Signing and sending transaction...");
    transaction.sign([wallet]);
    const signature = getSignature(transaction);
    const serializedTx = transaction.serialize();

    const txResponse = await transactionSenderAndConfirmationWaiter({
      connection: heliusConnection,
      serializedTransaction: Buffer.from(serializedTx),
      blockhashWithExpiryBlockHeight: {
        blockhash: transaction.message.recentBlockhash,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight,
      },
    });

    console.log("✅ Transaction executed successfully");
    console.log(`🔗 Transaction signature: ${signature}`);
    console.log(`💰 Sold ${amountToSell} tokens (${percentToSell}%)`);

    return {
      success: true,
      transactionSignature: signature,
      amountSold: amountToSell,
      receivedAmount: quote.outAmount / 10 ** 6,
    };
  } catch (error) {
    console.error("❌ Error selling tokens:", error);
    console.error("Stack trace:", error.stack);
    return {
      success: false,
      error: error.message,
    };
  }
}

const sellPercentOfTokenToZero = async (
  walletName,
  memeTokenAddress,
  percentToSell,
  millisecondsToWaitBetweenTries = 15 * 1000
) => {
  try {
    let totalPercentSold = 0;
    let numberOfTries = 0;
    let amountToSell;
    console.log(`
🎯 Starting Progressive Token Sale:
👤 Wallet: ${walletName}
💎 Token: ${memeTokenAddress}
📊 Target Percentage: ${percentToSell}%
⏱️ Delay Between Tries: ${millisecondsToWaitBetweenTries / 1000}s
    `);

    while (totalPercentSold < 100 && numberOfTries < 10) {
      console.log(`
🔄 Sale Attempt #${numberOfTries + 1}:
📊 Current Progress: ${totalPercentSold}%
🎯 Attempting: ${percentToSell}%
      `);

      const { success, transactionSignature, amountSold } =
        await sellTokenPercent(
          walletName,
          memeTokenAddress,
          percentToSell,
          amountToSell
        );
      if (!success) {
        console.error(`❌ Sale Failed for ${walletName}`);
      } else {
        totalPercentSold += percentToSell;
        numberOfTries++;
        amountToSell = amountSold;
        console.log(`
✅ Sale Successful:
💰 Sold: ${percentToSell}%
📈 Total Progress: ${totalPercentSold}%
🔗 Transaction: https://solscan.io/tx/${transactionSignature}
        `);

        if (totalPercentSold < 100 && numberOfTries < 10) {
          console.log(
            `⏳ Waiting ${
              millisecondsToWaitBetweenTries / 1000
            }s before next attempt...`
          );
          await new Promise((resolve) =>
            setTimeout(resolve, millisecondsToWaitBetweenTries)
          );
          console.log(`✨ Ready for next attempt`);
        }
      }
    }
    console.log(`
🎉 Sale Complete for ${walletName}!
📊 Total Sold: ${totalPercentSold}%
🔄 Total Attempts: ${numberOfTries}
💫 ✨ 🌟 💎 🚀 💰 🎯
    `);
  } catch (error) {
    console.error(`
❌ Sale Process Failed:
👤 Wallet: ${walletName}
⚠️ Error: ${error.message}
    `);
  }
};

// Export the individual functions for use in other files
module.exports = {
  getQuote,
  getSwapResponse,
  getTokenBalance,
  sellTokenPercent,
  sellPercentOfTokenToZero,
  swapAllTokens,
};
