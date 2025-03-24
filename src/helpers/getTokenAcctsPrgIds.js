const {
  connection,
  taxedTokenMintAddress,
  rewardsTokenMintAddress,
  distributorWallet,
} = require("../config/solana");
const { getAssociatedTokenAddress } = require("@solana/spl-token");

console.log(
  "[Token Accounts] Taxed Token Mint Address:",
  taxedTokenMintAddress
);
console.log(
  "[Token Accounts] Rewards Token Mint Address:",
  rewardsTokenMintAddress
);
console.log(
  "[Token Accounts] Distributor Wallet:",
  distributorWallet.publicKey
);

// Function to get token program ID
async function getTokenProgramId(mintAddress) {
  try {
    const accountInfo = await connection.getAccountInfo(mintAddress);
    if (!accountInfo) {
      throw new Error(`Account not found for mint: ${mintAddress.toBase58()}`);
    }
    return accountInfo.owner;
  } catch (error) {
    console.error(`Error getting token program ID: ${error.message}`);
    throw error;
  }
}

// Initialize token program IDs
async function initializeTokenProgramIds() {
  try {
    const taxedTokenProgramID = await getTokenProgramId(taxedTokenMintAddress);
    console.log(
      "[getTokenAcctsPrgIds] 💰 Taxed Token Program ID:",
      taxedTokenProgramID.toBase58()
    );

    const rewardsTokenProgramID = await getTokenProgramId(
      rewardsTokenMintAddress
    );
    console.log(
      "[getTokenAcctsPrgIds] 🎁 Rewards Token Program ID:",
      rewardsTokenProgramID.toBase58()
    );
  } catch (error) {
    console.error(
      "[getTokenAcctsPrgIds] Error initializing token program IDs:",
      error.message
    );
    process.exit(1);
  }
}

// Function to get associated token account
async function getAssociatedTokenAccount(mintAddress, ownerAddress) {
  try {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mintAddress,
      ownerAddress
    );
    return associatedTokenAddress;
  } catch (error) {
    console.error(`Error getting associated token account: ${error.message}`);
    throw error;
  }
}

// Initialize token accounts
async function initializeTokenAccounts() {
  try {
    // Get associated token accounts for distributor wallet
    const taxedTokenAccount = await getAssociatedTokenAccount(
      taxedTokenMintAddress,
      distributorWallet.publicKey
    );
    console.log(
      "[getTokenAcctsPrgIds] 💰 Distributor Taxed Token Account:",
      taxedTokenAccount.toBase58()
    );

    const rewardsTokenAccount = await getAssociatedTokenAccount(
      rewardsTokenMintAddress,
      distributorWallet.publicKey
    );
    console.log(
      "[getTokenAcctsPrgIds] 🎁 Distributor Rewards Token Account:",
      rewardsTokenAccount.toBase58()
    );
  } catch (error) {
    console.error(
      "[getTokenAcctsPrgIds] Error initializing token accounts:",
      error.message
    );
    process.exit(1);
  }
}

// Call both initialization functions
Promise.all([initializeTokenProgramIds(), initializeTokenAccounts()]).catch(
  (error) => {
    console.error(
      "[getTokenAcctsPrgIds] Error during initialization:",
      error.message
    );
    process.exit(1);
  }
);
