const {
  TOKEN_PROGRAM_ID,
  getAccount,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const { PublicKey } = require("@solana/web3.js");
const axios = require("axios");
const {
  distributorWallet,
  taxedTokenMintAddress,
  rewardsTokenMintAddress,
  taxedTokenSupply,
  distributorWalletTaxedTokenAccount,
  minAmountOfHoldingsForRewards,
  rewardsTokenProgramID,
  tokenMintAddress,
  distributorWalletRewardsTokenAccount,
  minRewardAmount,
  maxRewardAmount,
  decimals,
  liquidityPoolAddress,
} = require("../config/solana");
const { checkBalance } = require("./checkBalance");

const { batchTransferTokens } = require("./transferTokens");
const { swapPercentageOfTokens } = require("../jupiter");
require("dotenv").config();
const { executeTaxWithdrawal } = require("./executeWithdrawal");
const cron = require("node-cron");

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
        `📋 [Token Holders] Found ${accounts.length} holders on page ${page}`
      );

      if (accounts.length < 100) {
        wasLastPage = true;
      }

      for (const account of accounts) {
        // owner is the wallet address
        if (!account.amount || !account.owner || !account.address) {
          continue;
        }
        if (
          account.owner === liquidityPoolAddress ||
          account.address === liquidityPoolAddress
        ) {
          console.log("account is a liquidity pool. Moving on...");
          continue;
        }
        if (account.amount > minAmountOfHoldings) {
          const percentage = account.amount / totalSupply;
          if (percentage < 0.000001) {
            continue;
          }
          const tokenRewards = Math.floor(totalRewardsBalance * percentage);
          console.log("🚀 ~ tokenRewards:", tokenRewards);
          if (tokenRewards < 100000) {
            console.log("🚀 ~ tokenRewards is less than 1000");
            console.log("continuing 🧏🏼");
            continue;
          }
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
    "🎯 [Token Holders] Starting token holder analysis for token:",
    mintString
  );
  console.log("🎯 [Token Holders] Total rewards:", totalRewardsBalance);
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
    totalPercentage += accounts[account].percentage;
  }
  return accounts;
};
const distributeRewards = async () => {
  try {
    let balance = await checkBalance(
      distributorWalletRewardsTokenAccount.toString(),
      rewardsTokenProgramID
    );
    console.log("🤑🤑 balance :", balance);
    console.log("🤑🤑 taxedTokenMintAddress :", taxedTokenMintAddress);
    if (balance < 1000 * 10 ** decimals) {
      console.log("🧌🧌🧌 balance is less than 1000");
      console.log("🧌🧌🧌 too poor to distribute rewards!");

      return;
    }

    balance = balance * 0.25;
    const holders = await getAllTokenHolders(
      taxedTokenMintAddress.toString(),
      balance
    );
    console.log("🚀 ~ distributeRewards ~ holders:", holders);
    const allSignatures = await batchTransferTokens(holders, balance);
    console.log("📝 [Main] Batch transfer signatures:", allSignatures);
  } catch (error) {
    console.error("❌ [Main] Execution error:", error);
  }
};

const withdrawAndSwap = async () => {
  console.log(
    "😈 distributorWalletTaxedTokenAccount:: ",
    distributorWalletTaxedTokenAccount
  );
  const taxWithdrawalResult = await executeTaxWithdrawal(
    distributorWalletTaxedTokenAccount
  );
  console.log("📝 [Main] Tax withdrawal result:", taxWithdrawalResult);

  if (taxWithdrawalResult.signature) {
    console.log("✅ [Main] Tax withdrawal successful!");
  } else if (taxWithdrawalResult.status === "skipped") {
    return;
  } else {
    console.error("❌ [Main] Tax withdrawal failed");
    return;
  }

  let percentageToSwap = 100;

  const swapResult = await swapPercentageOfTokens(
    percentageToSwap,
    distributorWallet,
    distributorWalletTaxedTokenAccount,
    taxedTokenMintAddress,
    rewardsTokenMintAddress,
    (slippageBps = 2000)
  );
  console.log("🔄 [Main] Swap result:", swapResult);

  const { status, totalTokenRewards } = swapResult;
  console.log("📊 [Main] Swap status and rewards:", status, totalTokenRewards);
  return;
};

module.exports = {
  getTokenHolders,
  getAllTokenHolders,
  withdrawAndSwap,
  distributeRewards,
};
