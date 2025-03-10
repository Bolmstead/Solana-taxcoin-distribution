require("dotenv").config();
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");

const bs58 = require("bs58").default;

const DISTRIBUTOR_WALLET_PRIVATE_KEY = process.env.MAIN_WALLET_PRIVATE_KEY;
const DISTRIBUTOR_WALLET_TOKEN_ACCOUNT =
  process.env.MAIN_WALLET_PWEASE_TOKEN_ACCOUNT;
const MEME_COIN_ADDRESS = process.env.PWEASE_COIN_ADDRESS;
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
  const privateKeyBytes = bs58.decode(DISTRIBUTOR_WALLET_PRIVATE_KEY);
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
  if (!MEME_COIN_ADDRESS) {
    throw new Error("NO MEME COIN ADDRESS ");
  }
  tokenMint = new PublicKey(MEME_COIN_ADDRESS);
  console.log("Token mint initialized:", tokenMint.toBase58());
} catch (error) {
  console.error("Error initializing token mint:", error.message);

  process.exit(1);
}

module.exports = {
  connection,
  distributorWallet,
  tokenMint,
  DISTRIBUTOR_WALLET_TOKEN_ACCOUNT,
  MAX_TRANSACTION_SIZE,
};
