const { TOKEN_PROGRAM_ID, getAccount } = require("@solana/spl-token");
const axios = require("axios");
const {
  tokenMint,
  connection,
  distributorWallet,
  TAXED_TOKEN_ADDRESS,
  TARGET_MEME_COIN_ADDRESS,
  TAXED_WALLET_TOKEN_ACCOUNT,
  taxedTokenKeypair,
  rewardsTokenKeypair,
  decimals,
  taxedTokenSupply,
} = require("../config/solana");

const { LAMPORTS_PER_SOL, Keypair } = require("@solana/web3.js");
const { batchTransferTokens } = require("./transferTokens");
const { checkBalance } = require("./checkBalance");
const { swapAllTokens } = require("../jupiter");
require("dotenv").config();
const { executeTaxWithdrawal } = require("./withdrawTaxes");
const { initializeTokenAccounts } = require("./initializeTokenAccounts");
async function getTokenHolders(
  page,
  currentAccounts,
  totalRewardsBalance,
  minAmountOfHoldings = 1000
) {
  try {
    let wasLastPage = false;

    console.log(
      "🚀 ~ getTokenHolders ~ taxedTokenKeypair.publicKey:",
      taxedTokenKeypair.publicKey
    );

    const response = await axios.post(
      process.env.HELIUS_RPC_URL,
      {
        jsonrpc: "2.0",
        id: "my-id",
        method: "getTokenAccounts",
        params: {
          mint: taxedTokenKeypair.publicKey,
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
    console.log("🚀 ~ decimalNumber:", decimalNumber);
    const totalSupply = taxedTokenSupply * decimalNumber;
    console.log("🚀 ~ totalSupply:", totalSupply);

    console.log("Response data:", response.data);

    if (response.data.result) {
      const accounts = response.data.result.token_accounts;
      console.log(`Found ${accounts.length} token accounts`);

      if (accounts.length < 100) {
        wasLastPage = true;
      }

      for (const account of accounts) {
        console.log("🚀 ~ account:", account);
        // owner is the wallet address
        if (!account.amount || !account.owner || !account.address) {
          continue;
        }
        if (account.amount > minAmountOfHoldings) {
          const percentage = account.amount / totalSupply;
          console.log("🚀 ~ percentage: ", `%${percentage * 100}`);
          if (percentage < 0.000001) {
            continue;
          }
          const tokenRewards = Math.floor(totalRewardsBalance * percentage);
          console.log("🚀 ~ tokenRewards:", tokenRewards);
          currentAccounts[account.owner] = {
            reward: tokenRewards,

            percentage: percentage,
          };
        }
      }
      page++;
    }

    return { updatedAccounts: currentAccounts, wasLastPage };
  } catch (error) {
    console.error("Error fetching token holders:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
    return [];
  }
}

const getAllTokenHolders = async (totalRewardsBalance) => {
  console.log(
    "🚀 ~ getAllTokenHolders ~ totalRewardsBalance:",
    totalRewardsBalance
  );
  let justKeepGoing = true;
  let page = 1;
  let accounts = {};
  let totalPercentage = 0;

  if (!totalRewardsBalance) {
    console.log("Tax wallet balance is 0");
    return "No Tax Wallet Balance!!!";
  }

  while (justKeepGoing) {
    console.log("Getting token holders...");
    console.log("🚀 ~ getAllTokenHolders ~ page:", page);
    const { updatedAccounts, wasLastPage } = await getTokenHolders(
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
  for (const account of Object.keys(accounts)) {
    console.log("🚀 ~ account:", account);
    console.log("🚀 ~ accounts[account]:", accounts[account]);
    console.log("🚀 ~ accounts[account].reward:", accounts[account].reward);
    totalPercentage += accounts[account].percentage;
    console.log("🚀 ~ totalPercentage:", totalPercentage);
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
    // unlock taxed tokens ❌
    try {
      const {
        distributorWalletTaxedTokenAccount,
        distributorWalletRewardsTokenAccount,
      } = await initializeTokenAccounts();
      console.log(
        "🚀 ~ execute ~ distributorWalletRewardsTokenAccount:",
        distributorWalletRewardsTokenAccount
      );
      console.log(
        "🚀 ~ execute ~ distributorWalletTaxedTokenAccount:",
        distributorWalletTaxedTokenAccount
      );

      // withdraw taxes ❌
      const taxWithdrawalResult = await executeTaxWithdrawal(
        distributorWalletTaxedTokenAccount,
        distributorWalletRewardsTokenAccount
      );
      console.log("🚀 ~ execute ~ taxWithdrawalResult:", taxWithdrawalResult);
      return;
      // swap tokens ✅
      const swapResult = await swapAllTokens(
        distributorWallet,
        TAXED_WALLET_TOKEN_ACCOUNT,
        TAXED_TOKEN_ADDRESS,
        TARGET_MEME_COIN_ADDRESS,
        (slippageBps = 2000),
        (priorityFee = 0.05)
      );
      console.log("🚀 ~ execute ~ swapResult:", swapResult);
      const { status, totalTokenRewards } = swapResult;
      console.log(
        "🚀 ~ execute ~ status, totalTokenRewards :",
        status,
        totalTokenRewards
      );

      if (status === "error") {
        console.error("Error swapping tokens:", swapResult.error);
        return;
      }
      const holders = await getAllTokenHolders(totalTokenRewards);
      console.log("🚀 ~ holders:", holders);
      // transfer tokens ❌
      const allSignatures = await batchTransferTokens(
        holders,
        totalTokenRewards
      );
      console.log("🚀 ~ allSignatures:", allSignatures);
    } catch (error) {
      // Handle error...
    }
  };
  execute();
}
