const { TOKEN_PROGRAM_ID, getAccount } = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");
const axios = require("axios");
const {
  tokenMint,
  connection,
  distributorWallet,
  TAXED_TOKEN_ADDRESS,
  TARGET_MEME_COIN_ADDRESS,
  TAXED_WALLET_TOKEN_ACCOUNT,
  taxedTokenMintAddress,
  rewardsTokenMintAddress,
  decimals,
  taxedTokenSupply,
  distributorWalletTaxedTokenAccount,
  minAmountOfHoldingsForRewards,
} = require("../config/solana");

const { LAMPORTS_PER_SOL, Keypair } = require("@solana/web3.js");
const { batchTransferTokens } = require("./transferTokens");
const { checkBalance } = require("./checkBalance");
const { swapPercentageOfTokens } = require("../jupiter");
require("dotenv").config();
const { executeTaxWithdrawal } = require("./executeWithdrawal");
const { initializeTokenAccounts } = require("./initializeTokenAccounts");
const { testWithdrawDemo } = require("./executeWithdrawal");
async function getTokenHolders(
  mintString,
  page,
  currentAccounts,
  totalRewardsBalance,
  minAmountOfHoldings = minAmountOfHoldingsForRewards
) {
  try {
    let wasLastPage = false;

    console.log("🔍 [Token Holders] Fetching accounts for mint:", mintString);

    const response = await axios.post(
      process.env.HELIUS_RPC_URL,
      {
        jsonrpc: "2.0",
        id: "my-id",
        method: "getTokenAccounts",
        params: {
          mint: mintString,
          limit: 100,
          page: page,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const decimalNumber = 10 ** decimals;
    console.log("📊 [Token Holders] Decimal multiplier:", decimalNumber);
    const totalSupply = taxedTokenSupply * decimalNumber;
    console.log("💰 [Token Holders] Total token supply:", totalSupply);

    if (response.data.result) {
      const accounts = response.data.result.token_accounts;
      console.log(
        `📋 [Token Holders] Found ${accounts.length} token accounts on page ${page}`
      );

      if (accounts.length < 100) {
        wasLastPage = true;
      }

      for (const account of accounts) {
        // owner is the wallet address
        if (!account.amount || !account.owner || !account.address) {
          continue;
        }
        if (account.amount > minAmountOfHoldings) {
          const percentage = account.amount / totalSupply;
          console.log(
            "📈 [Token Holders] Account percentage:",
            `%${(percentage * 100).toFixed(6)}`
          );
          if (percentage < 0.000001) {
            continue;
          }
          const tokenRewards = Math.floor(totalRewardsBalance * percentage);
          console.log("🎁 [Token Holders] Calculated rewards:", tokenRewards);
          currentAccounts[account.owner] = {
            currentHoldings: account.amount / 10 ** decimals,
            reward: tokenRewards,
            percentage: percentage,
          };
        }
      }
      page++;
    }

    return { updatedAccounts: currentAccounts, wasLastPage };
  } catch (error) {
    console.error(
      "❌ [Token Holders] Error fetching token holders:",
      error.message
    );
    if (error.response) {
      console.error("❌ [Token Holders] Response data:", error.response.data);
    }
    return [];
  }
}

const getAllTokenHolders = async (mintString, totalRewardsBalance) => {
  console.log(
    "🎯 [Token Holders] Starting token holder analysis with total rewards:",
    totalRewardsBalance
  );
  let justKeepGoing = true;
  let page = 1;
  let accounts = {};
  let totalPercentage = 0;

  if (!totalRewardsBalance) {
    console.log("⚠️ [Token Holders] Tax wallet balance is 0");
    return "No Tax Wallet Balance!!!";
  }

  while (justKeepGoing) {
    console.log("🔄 [Token Holders] Processing page:", page);
    const { updatedAccounts, wasLastPage } = await getTokenHolders(
      mintString,
      page,
      accounts,
      totalRewardsBalance
    );
    accounts = updatedAccounts;
    if (wasLastPage) {
      break;
    }
    page++;
  }

  console.log("\n📊 [Token Holders] Final Distribution Summary:");
  for (const account of Object.keys(accounts)) {
    console.log("👤 [Token Holders] Account:", account);
    console.log("📈 [Token Holders] Distribution:", accounts[account]);
    console.log("🎁 [Token Holders] Reward amount:", accounts[account].reward);
    totalPercentage += accounts[account].percentage;
    console.log(
      "📊 [Token Holders] Running total percentage:",
      `%${(totalPercentage * 100).toFixed(6)}`
    );
  }
  return accounts;
};

module.exports = {
  getTokenHolders,
  getAllTokenHolders,
};

// Only run if called directly
if (require.main === module) {
  const execute = async () => {
    try {
      const isTest = true;
      console.log("🚀 [Main] Starting token distribution process...");

      const taxWithdrawalResult = await executeTaxWithdrawal(
        distributorWalletTaxedTokenAccount
      );
      console.log("📝 [Main] Tax withdrawal result:", taxWithdrawalResult);

      if (taxWithdrawalResult.signature) {
        console.log("✅ [Main] Tax withdrawal successful!");
      } else if (taxWithdrawalResult.status === "No Accounts") {
        console.log("🤷‍♀️ [Main] No tax to withdraw. continuing...");
      } else {
        console.error("❌ [Main] Tax withdrawal failed");
      }

      const swapResult = await swapPercentageOfTokens(
        isTest,
        100,
        distributorWallet,
        distributorWalletTaxedTokenAccount,
        taxedTokenMintAddress,
        rewardsTokenMintAddress,
        (slippageBps = 2000),
        (priorityFee = 0.05)
      );
      console.log("🔄 [Main] Swap result:", swapResult);

      const { status, totalTokenRewards } = swapResult;
      console.log(
        "📊 [Main] Swap status and rewards:",
        status,
        totalTokenRewards
      );

      if (status === "error") {
        console.error("❌ [Main] Error swapping tokens:", swapResult.error);
        return;
      }

      const holders = await getAllTokenHolders(
        isTest
          ? "Grxe7CuqVBURzotjuyjVmdwif96ifvzJNrFmYq6cmJj9"
          : taxedTokenMintAddress.toString(),
        totalTokenRewards
      );
      console.log("👥 [Main] Token holders distribution:", holders);
      const allSignatures = await batchTransferTokens(
        holders,
        totalTokenRewards
      );
      console.log("📝 [Main] Batch transfer signatures:", allSignatures);
    } catch (error) {
      console.error("❌ [Main] Execution error:", error);
    }
  };
  execute();
}
