require("dotenv").config();
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const bs58 = require("bs58");

const DISTRIBUTOR_WALLET_PRIVATE_KEY = process.env.TEST_WITHDRAW_AUTHORITY_PRIVATE_KEY;
const DISTRIBUTOR_WALLET_PUBLIC_KEY = process.env.TEST_WITHDRAW_AUTHORITY_PUBLIC_KEY;
const DISTRIBUTOR_WALLET_TOKEN_ACCOUNT = process.env.TEST_WITHDRAW_AUTHORITY_TOKEN_ACCOUNT;
const TAXED_WALLET_TOKEN_ACCOUNT =
  process.env.PIETRO_PAROLIN_TEST_TAX_WALLET_TOKEN_ACCOUNT;


const TAXED_MEMECOIN_ADDRESS = process.env.PIETRO_PAROLIN_COIN_ADDRESS;

const DISTRIBUTING_REWARDS_TOKEN_ACCOUNT =
  process.env.PWEASE_TEST_TAX_WALLET_TOKEN_ACCOUNT;
const TARGET_MEME_COIN_ADDRESS = process.env.PWEASE_COIN_ADDRESS;
console.log("🚀 ~ TARGET_MEME_COIN_ADDRESS:", TARGET_MEME_COIN_ADDRESS);
const MAX_TRANSACTION_SIZE = 1232;
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
let tokenMint;
try {
  if (!TARGET_MEME_COIN_ADDRESS) {
    throw new Error("NO MEME COIN ADDRESS ");
  }
  tokenMint = new PublicKey(TARGET_MEME_COIN_ADDRESS);
  console.log("Token mint initialized:", tokenMint.toBase58());
} catch (error) {
  console.error("Error initializing token mint:", error.message);

  process.exit(1);
}

module.exports = {
  connection,
  distributorWallet,
  tokenMint,
  DISTRIBUTING_REWARDS_TOKEN_ACCOUNT,
  MAX_TRANSACTION_SIZE,
  TAXED_MEMECOIN_ADDRESS,
  TAXED_WALLET_TOKEN_ACCOUNT,
  TARGET_MEME_COIN_ADDRESS,
};
