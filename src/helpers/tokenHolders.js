const { TOKEN_PROGRAM_ID, getAccount } = require("@solana/spl-token");
const axios = require("axios");
const {
  tokenMint,
  connection,
  distributorWallet,
  DISTRIBUTOR_WALLET_TOKEN_ACCOUNT,
} = require("../config/solana");
const { LAMPORTS_PER_SOL } = require("@solana/web3.js");
const { batchTransferTokens } = require("./transferTokens");
const { checkBalance } = require("./checkBalance");
require("dotenv").config();

async function getTokenHolders(
  page,
  currentAccounts,
  taxWalletBalance,
  minAmountOfHoldings = 1000
) {
  try {
    let wasLastPage = false;
    
    const response = await axios.post(
      process.env.HELIUS_RPC_URL,
      {
        jsonrpc: "2.0",
        id: "my-id",
        method: "getTokenAccounts",
        params: {
          mint: tokenMint.toBase58(),
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
    const decimalNumber = 10 ** process.env.DECIMALS;
    console.log("🚀 ~ decimalNumber:", decimalNumber);
    const totalSupply = process.env.SUPPLY * decimalNumber;
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
          const tokenRewards = Math.floor(taxWalletBalance * percentage);
          console.log("🚀 ~ tokenRewards:", tokenRewards);
          currentAccounts[account.owner] = {
            reward: tokenRewards,
            tokenAccount: account.address,
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

const getAllTokenHolders = async (taxWalletBalance) => {
  let justKeepGoing = true;
  let page = 1;
  let accounts = {};
  let totalPercentage = 0;

  if (!taxWalletBalance) {
    console.log("Tax wallet balance is 0");
    return "No Tax Wallet Balance!!!";
  }

  while (justKeepGoing) {
    console.log("Getting token holders...");
    console.log("🚀 ~ getAllTokenHolders ~ page:", page);
    const { updatedAccounts, wasLastPage } = await getTokenHolders(
      page,
      accounts,
      taxWalletBalance
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
  console.log("accounts.length:: ", accounts.length);
  return accounts;
};

module.exports = {
  getTokenHolders,
  getAllTokenHolders,
};

// Only run if called directly
if (require.main === module) {
  const execute = async () => {
    let taxWalletBalance = await checkBalance(
      distributorWallet.publicKey.toString(),
      DISTRIBUTOR_WALLET_TOKEN_ACCOUNT
    );
    console.log("🚀 ~ taxWalletBalance:", taxWalletBalance);
    console.log("🚀 DIVIDED BY 4 taxWalletBalance:", taxWalletBalance);
    const holders = await getAllTokenHolders(taxWalletBalance);
    console.log("🚀 ~ holders:", holders);
    const allSignatures = await batchTransferTokens(holders, taxWalletBalance);
    console.log("🚀 ~ allSignatures:", allSignatures);
  };
  execute();
}
