require("dotenv").config();
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const bs58 = require("bs58");

const TAXED_TOKEN_ADDRESS = process.env.MRR_COIN_ADDRESS;
let TAXED_TOKEN_PROGRAM_ID = process.env.MRR_COIN_PROGRAM_ID;

const REWARDS_TOKEN_ADDRESS = process.env.ROUTINE_COIN_ADDRESS;
let REWARDS_TOKEN_PROGRAM_ID = process.env.ROUTINE_COIN_PROGRAM_ID;

const WITHDRAW_AUTHORITY_WALLET_PRIVATE_KEY =
  process.env.WITHDRAW_AUTHORITY_WALLET_PRIVATE_KEY;

const DISTRIBUTOR_WALLET_PRIVATE_KEY =
  process.env.DISTRIBUTOR_WALLET_PRIVATE_KEY;

const DISTRIBUTOR_WALLET_TAXED_TOKEN_ACCOUNT =
  process.env.DISTRIBUTOR_WALLET_TAXED_TOKEN_ACCOUNT;

const DISTRIBUTOR_WALLET_REWARDS_TOKEN_ACCOUNT =
  process.env.DISTRIBUTOR_WALLET_REWARDS_TOKEN_ACCOUNT;

const decimals = 6;
const taxedTokenSupply = 1000000000;
const minAmountOfHoldingsForRewards = 100000;

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

// Token mint
let taxedTokenMintAddress;
try {
  if (!TAXED_TOKEN_ADDRESS) {
    throw new Error(
      "[Solana Config] 💰 TAXED_TOKEN_ADDRESS is not set in .env file"
    );
  }
  taxedTokenMintAddress = new PublicKey(TAXED_TOKEN_ADDRESS);
  console.log(
    "[Solana Config] 💰 Taxed Token mint initialized:",
    taxedTokenMintAddress.toBase58()
  );
} catch (error) {
  console.error(
    "[Solana Config] 💰 Taxed Token mint initialization error:",
    error.message
  );
  process.exit(1);
}

// Token mint
let rewardsTokenMintAddress;
try {
  if (!REWARDS_TOKEN_ADDRESS) {
    throw new Error(
      "[Solana Config] 🎁 REWARDS_TOKEN_ADDRESS is not set in .env file"
    );
  }
  rewardsTokenMintAddress = new PublicKey(REWARDS_TOKEN_ADDRESS);
  console.log(
    "[Solana Config] 🎁 Rewards Token mint initialized:",
    rewardsTokenMintAddress.toBase58()
  );
} catch (error) {
  console.error(
    "[Solana Config] 🎁 Rewards Token mint initialization error:",
    error.message
  );
  process.exit(1);
}

// Initialize distributor wallet from private key
let distributorWallet;
try {
  if (!DISTRIBUTOR_WALLET_PRIVATE_KEY) {
    throw new Error(
      "[Solana Config] 🔑 DISTRIBUTOR_WALLET_PRIVATE_KEY is not set in .env file"
    );
  }
  const privateKeyBytes = bs58.default.decode(DISTRIBUTOR_WALLET_PRIVATE_KEY);
  distributorWallet = Keypair.fromSecretKey(privateKeyBytes);
  console.log(
    "[Solana Config] 🔑 Distributor Wallet initialized successfully. Public key:",
    distributorWallet.publicKey.toBase58()
  );
} catch (error) {
  console.error(
    "[Solana Config] 🔑 Distributor Wallet initialization error:",
    error.message
  );
  process.exit(1);
}

// Initialize Withdraw Authority wallet from private key
let withdrawAuthorityWallet;
try {
  if (!WITHDRAW_AUTHORITY_WALLET_PRIVATE_KEY) {
    throw new Error(
      "[Solana Config] 🔑 WITHDRAW_AUTHORITY_WALLET_PRIVATE_KEY is not set in .env file"
    );
  }
  const privateKeyBytes = bs58.default.decode(
    WITHDRAW_AUTHORITY_WALLET_PRIVATE_KEY
  );
  withdrawAuthorityWallet = Keypair.fromSecretKey(privateKeyBytes);
  console.log(
    "[Solana Config] 🔑 Withdraw Authority Wallet initialized successfully. public key:",
    withdrawAuthorityWallet.publicKey.toBase58()
  );
} catch (error) {
  console.error(
    "[Solana Config] 🔑 Withdraw Authority Wallet initialization error:",
    error.message
  );
  process.exit(1);
}

// distributor wallet taxed token account
let distributorWalletTaxedTokenAccount;
try {
  if (!DISTRIBUTOR_WALLET_TAXED_TOKEN_ACCOUNT) {
    console.log(
      "[Solana Config] 🚨🚨🚨 DISTRIBUTOR_WALLET_TAXED_TOKEN_ACCOUNT is not set in .env file 🚨🚨🚨"
    );
  } else {
    distributorWalletTaxedTokenAccount = new PublicKey(
      DISTRIBUTOR_WALLET_TAXED_TOKEN_ACCOUNT
    );
    console.log(
      "[Solana Config] 💰 Distributor Wallet Taxed Token Account initialized:",
      distributorWalletTaxedTokenAccount.toBase58()
    );
  }
} catch (error) {
  console.error(
    "[Solana Config] 💰 Distributor Wallet Taxed Token Account initialization error:",
    error.message
  );
  process.exit(1);
}

// distributor wallet rewards token account
let distributorWalletRewardsTokenAccount;
try {
  if (!DISTRIBUTOR_WALLET_REWARDS_TOKEN_ACCOUNT) {
    console.log(
      "[Solana Config] 🚨🚨🚨 DISTRIBUTOR_WALLET_REWARDS_TOKEN_ACCOUNT is not set in .env file 🚨🚨🚨"
    );
  } else {
    distributorWalletRewardsTokenAccount = new PublicKey(
      DISTRIBUTOR_WALLET_REWARDS_TOKEN_ACCOUNT
    );
    console.log(
      "[Solana Config] 💎 Distributor Wallet Rewards Token Account initialized:",
      distributorWalletRewardsTokenAccount.toBase58()
    );
  }
} catch (error) {
  console.error(
    "[Solana Config] 💎 Distributor Wallet Rewards Token Account initialization error:",
    error.message
  );
  process.exit(1);
}

let taxedTokenProgramID;
try {
  if (!TAXED_TOKEN_PROGRAM_ID) {
    console.log(
      "[Solana Config] 🚨🚨🚨 TAXED_TOKEN_PROGRAM_ID is not set in .env file 🚨🚨🚨"
    );
  } else {
    taxedTokenProgramID = new PublicKey(TAXED_TOKEN_PROGRAM_ID);
    console.log(
      "[Solana Config] 🚕🪪 Taxed Token Program ID initialized:",
      taxedTokenProgramID.toBase58()
    );
  }
} catch (error) {
  console.error(
    "[Solana Config] 🚕🪪 Taxed Token Program ID initialization error:",
    error.message
  );
  process.exit(1);
}

let rewardsTokenProgramID;
try {
  if (!REWARDS_TOKEN_PROGRAM_ID) {
    console.log(
      "[Solana Config] 🚨🚨🚨 REWARDS_TOKEN_PROGRAM_ID is not set in .env file 🚨🚨🚨"
    );
  } else {
    rewardsTokenProgramID = new PublicKey(REWARDS_TOKEN_PROGRAM_ID);
    console.log(
      "[Solana Config] 🤑🪪 Rewards Token Program ID initialized:",
      rewardsTokenProgramID.toBase58()
    );
  }
} catch (error) {
  console.error(
    "[Solana Config] 🤑🪪 Rewards Token Program ID initialization error:",
    error.message
  );
  process.exit(1);
}

module.exports = {
  connection,
  distributorWallet,
  taxedTokenMintAddress,
  rewardsTokenMintAddress,
  decimals,
  taxedTokenSupply,
  distributorWalletTaxedTokenAccount,
  distributorWalletRewardsTokenAccount,
  withdrawAuthorityWallet,
  minAmountOfHoldingsForRewards,
  taxedTokenProgramID,
  rewardsTokenProgramID,
};
