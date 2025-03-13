require("dotenv").config();
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const { getAssociatedTokenAddress } = require("@solana/spl-token");
const bs58 = require("bs58");

const TAXED_TOKEN_ADDRESS = process.env.TEST_BROC_COIN_ADDRESS;
const REWARDS_TOKEN_ADDRESS = process.env.PWEASE_COIN_ADDRESS;
const DISTRIBUTOR_WALLET_PRIVATE_KEY =
  process.env.TEST_WITHDRAW_AUTHORITY_PRIVATE_KEY;
const decimals = 6;
const taxedTokenSupply = 1000000000;

// Initialize connection to Solana network
const getRpcUrl = () => {
  if (
    process.env.HELIUS_RPC_URL &&
    process.env.SOLANA_NETWORK === "mainnet-beta"
  ) {
    return process.env.HELIUS_RPC_URL;
  } else if (
    process.env.HELIUS_DEV_NET_RPC_URL &&
    process.env.SOLANA_NETWORK !== "mainnet-beta"
  ) {
    return process.env.HELIUS_DEV_NET_RPC_URL;
  } else if (process.env.QUICKNODE_RPC_URL) {
    return process.env.QUICKNODE_RPC_URL;
  }

  return process.env.SOLANA_NETWORK === "mainnet-beta"
    ? "https://api.mainnet-beta.solana.com"
    : process.env.SOLANA_NETWORK === "testnet"
    ? "https://api.testnet.solana.com"
    : "https://api.devnet.solana.com";
};

const connection = new Connection(getRpcUrl(), "confirmed");

// Initialize distributor wallet from private key
let distributorWallet;
try {
  if (!DISTRIBUTOR_WALLET_PRIVATE_KEY) {
    throw new Error("WALLET is not set in .env file");
  }
  const privateKeyBytes = bs58.default.decode(DISTRIBUTOR_WALLET_PRIVATE_KEY);
  distributorWallet = Keypair.fromSecretKey(privateKeyBytes);
  console.log(
    "Wallet initialized successfully. Public key:",
    distributorWallet.publicKey.toBase58()
  );
} catch (error) {
  console.error("Error initializing wallet:", error.message);
  process.exit(1);
}

// Token mint
let taxedTokenKeypair;
try {
  if (!TAXED_TOKEN_ADDRESS) {
    throw new Error("NO MEME COIN ADDRESS ");
  }
  taxedTokenKeypair = new PublicKey(TAXED_TOKEN_ADDRESS);
  console.log("Taxed Token mint initialized:", taxedTokenKeypair.toBase58());
} catch (error) {
  console.error("Error initializing token mint:", error.message);
  process.exit(1);
}

// Token mint
let rewardsTokenKeypair;
try {
  if (!REWARDS_TOKEN_ADDRESS) {
    throw new Error("NO MEME COIN ADDRESS ");
  }
  rewardsTokenKeypair = new PublicKey(REWARDS_TOKEN_ADDRESS);
  console.log(
    "Rewards Token mint initialized:",
    rewardsTokenKeypair.toBase58()
  );
} catch (error) {
  console.error("Error initializing token mint:", error.message);
  process.exit(1);
}

// Token accounts
let distributorWalletTaxedTokenAccount;
let distributorWalletRewardsTokenAccount;

// Initialize token accounts
async function initializeTokenAccounts() {
  try {
    // Distributor wallet Taxed token account
    distributorWalletTaxedTokenAccount = await getAssociatedTokenAddress(
      taxedTokenKeypair,
      distributorWallet.publicKey
    );

    console.log(
      "Token account for wallet distributorWalletTaxedTokenAccount",
      distributorWalletTaxedTokenAccount
    );

    // Distributor wallet Rewards token account
    distributorWalletRewardsTokenAccount = await getAssociatedTokenAddress(
      rewardsTokenKeypair,
      distributorWallet.publicKey
    );
    console.log(
      "Token account for wallet distributorWalletRewardsTokenAccount",
      distributorWalletRewardsTokenAccount
    );
  } catch (error) {
    console.error("Error initializing token accounts:", error.message);
    process.exit(1);
  }
}

module.exports = {
  connection,
  distributorWallet,
  taxedTokenKeypair,
  rewardsTokenKeypair,
  decimals,
  taxedTokenSupply,
};
