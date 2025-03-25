const { Keypair, clusterApiUrl, PublicKey } = require("@solana/web3.js");
const {
  getTransferFeeAmount,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
  withdrawWithheldTokensFromMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  taxedTokenMintAddress,
  withdrawAuthorityWallet,
  taxedTokenProgramID,
  rewardsTokenProgramID,
  decimals,
} = require("../config/solana.js");
const dotenv = require("dotenv");
const bs58 = require("bs58").default;
const BN = require("bn.js");

dotenv.config();

const BATCH_SIZE = 10; // Process 10 accounts at a time

async function executeTaxWithdrawal(destinationTokenAccount) {
  try {
    console.log(
      "🔑 Distributor Wallet Private Key:",
      distributorWallet.secretKey
    );
    console.log("🔑 Destination Token Account:", destinationTokenAccount);

    const payer = withdrawAuthorityWallet;
    console.log("💳 Payer Wallet:", payer);

    console.log("💰 Taxed Token Mint Address:", taxedTokenMintAddress);

    const withdrawWithheldAuthority = withdrawAuthorityWallet;
    console.log(
      "👮 Withdraw Authority Set:",
      withdrawWithheldAuthority.publicKey.toString()
    );

    const recipientKeypair = distributorWallet;
    console.log("📫 Recipient Address:", recipientKeypair.publicKey.toString());

    const balance = await connection.getBalance(payer.publicKey);
    console.log("💎 Current SOL Balance:", balance / 1000000000, "SOL");

    if (balance < 10000000) {
      // 0.01 SOL
      throw new Error(
        "⚠️ Not enough SOL in payer account, please fund: " +
          payer.publicKey.toBase58()
      );
    }

    console.log("🔍 Fetching all token accounts...");
    console.log("🔍 Using Token Program ID:", TOKEN_2022_PROGRAM_ID.toString());

    // Get all token accounts for the taxed token mint
    const tokenAccounts = await connection.getProgramAccounts(
      TOKEN_2022_PROGRAM_ID,
      {
        filters: [
          {
            memcmp: {
              offset: 0, // Token account mint offset
              bytes: taxedTokenMintAddress.toBase58(),
            },
          },
        ],
      }
    );
    console.log("🚀 ~ executeTaxWithdrawal ~ tokenAccounts:", tokenAccounts);

    console.log("📊 Total token accounts found:", tokenAccounts.length);

    const accountsToWithdrawFrom = [];
    for (const account of tokenAccounts) {
      try {
        const accountData = unpackAccount(
          account.pubkey,
          account.account,
          TOKEN_2022_PROGRAM_ID
        );
        if (accountData.amount > 0) {
          accountsToWithdrawFrom.push(account.pubkey);
        }
      } catch (error) {
        console.error(
          `Error processing account ${account.pubkey.toString()}:`,
          error
        );
      }
    }

    if (accountsToWithdrawFrom.length === 0) {
      console.log(
        "❌ No accounts to withdraw from: no transfers have been made"
      );
      return {
        status: "No Accounts",
      };
    } else {
      console.log(
        "✨ Found",
        accountsToWithdrawFrom.length,
        "accounts to withdraw from 🤑"
      );
    }
    if (accountsToWithdrawFrom.length < 5) {
      console.log(
        "👀 Less than 5 accounts to withdraw from, skipping tax withdrawal"
      );
      return {
        status: "skipped",
      };
    }

    const signatures = [];

    // First try withdrawing from the mint
    console.log("Attempting to withdraw from mint...");
    console.log("📝 Withdrawal arguments:");
    console.log("   Payer:", payer.publicKey.toString());
    console.log("   Mint Address:", taxedTokenMintAddress.toString());
    console.log("   Destination:", destinationTokenAccount.toString());
    console.log(
      "   Authority:",
      withdrawWithheldAuthority.publicKey.toString()
    );
    console.log("   Signers:", []);
    console.log("   Multiwall:", undefined);
    console.log("   Program ID:", TOKEN_PROGRAM_ID.toString());

    try {
      const withdrawFromMintSig = await withdrawWithheldTokensFromMint(
        connection,
        payer,
        taxedTokenMintAddress,
        destinationTokenAccount,
        withdrawWithheldAuthority,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      console.log(
        "💼 Mint withdrawal successful! Check transaction:",
        `\n🔗 https://solana.fm/tx/${withdrawFromMintSig}?cluster=devnet-solana`
      );
      signatures.push(withdrawFromMintSig);
    } catch (mintError) {
      console.log(
        "⚠️ Mint withdrawal failed, continuing with account withdrawals..."
      );
      console.log("   Error:", mintError.message);
    }

    // Process accounts in batches
    console.log("\nAttempting to withdraw from accounts in batches...");

    for (let i = 0; i < accountsToWithdrawFrom.length; i += BATCH_SIZE) {
      const batch = accountsToWithdrawFrom.slice(i, i + BATCH_SIZE);
      console.log(
        `\nProcessing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(
          accountsToWithdrawFrom.length / BATCH_SIZE
        )}`
      );
      console.log(`Batch size: ${batch.length} accounts`);

      const withdrawTokensSig = await withdrawWithheldTokensFromAccounts(
        connection,
        payer,
        taxedTokenMintAddress,
        destinationTokenAccount,
        withdrawWithheldAuthority,
        [],
        batch,
        undefined,
        TOKEN_2022_PROGRAM_ID
      );

      console.log(
        "💼 Batch withdrawal successful! Check transaction:",
        `\n🔗 https://solana.fm/tx/${withdrawTokensSig}?cluster=devnet-solana`
      );
      signatures.push(withdrawTokensSig);
    }

    return {
      signature: signatures,
      status: "success",
      totalBatches: Math.ceil(accountsToWithdrawFrom.length / BATCH_SIZE),
      successfulBatches: signatures.length,
    };
  } catch (error) {
    console.error("❌ Withdrawal failed:", error);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
    if (error.transaction) {
      console.error("Transaction details:", error.transaction);
    }
    throw error;
  }
}

module.exports = {
  executeTaxWithdrawal,
};
