const { Keypair, clusterApiUrl } = require("@solana/web3.js");
const {
  getTransferFeeAmount,
  unpackAccount,
  withdrawWithheldTokensFromAccounts,
  withdrawWithheldTokensFromMint,
} = require("@solana/spl-token");
const {
  connection,
  distributorWallet,
  taxedTokenMintAddress,
  withdrawAuthorityWallet,
  taxedTokenProgramID,
  rewardsTokenProgramID,
} = require("../config/solana.js");
const dotenv = require("dotenv");
const bs58 = require("bs58").default;
dotenv.config();

const BATCH_SIZE = 10; // Process 10 accounts at a time

async function executeTaxWithdrawal(destinationTokenAccount) {
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
  const allAccounts = await connection.getProgramAccounts(taxedTokenProgramID, {
    commitment: "confirmed",
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: taxedTokenMintAddress.toString(),
        },
      },
    ],
  });
  console.log("📊 Total accounts found:", allAccounts.length);

  const accountsToWithdrawFrom = [];

  console.log("🔎 Analyzing accounts for withheld fees...");
  for (const accountInfo of allAccounts) {
    try {
      const account = unpackAccount(
        accountInfo.pubkey,
        accountInfo.account,
        taxedTokenProgramID
      );

      const transferFeeAmount = getTransferFeeAmount(account);

      if (
        transferFeeAmount !== null &&
        transferFeeAmount.withheldAmount > BigInt(0)
      ) {
        console.log(
          "💰 Found account with withheld fees:",
          accountInfo.pubkey.toString()
        );
        console.log(
          "   Withheld amount:",
          transferFeeAmount.withheldAmount.toString()
        );
        console.log("   Account data length:", accountInfo.account.data.length);
        accountsToWithdrawFrom.push(accountInfo.pubkey);
      }
    } catch (error) {
      console.error(
        "Error processing account",
        accountInfo.pubkey.toString(),
        ":",
        error.message
      );
    }
  }

  if (accountsToWithdrawFrom.length === 0) {
    console.log("❌ No accounts to withdraw from: no transfers have been made");
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

  console.log("🚀 Initiating withdrawal transactions...");
  try {
    // First try withdrawing from the mint
    console.log("Attempting to withdraw from mint...");
    const withdrawFromMintSig = await withdrawWithheldTokensFromMint(
      connection,
      payer,
      taxedTokenMintAddress,
      destinationTokenAccount,
      withdrawWithheldAuthority,
      [],
      undefined,
      taxedTokenProgramID
    );

    console.log(
      "💼 Mint withdrawal successful! Check transaction:",
      `\n🔗 https://solana.fm/tx/${withdrawFromMintSig}?cluster=devnet-solana`
    );

    // Process accounts in batches
    console.log("\nAttempting to withdraw from accounts in batches...");
    const signatures = [];

    for (let i = 0; i < accountsToWithdrawFrom.length; i += BATCH_SIZE) {
      const batch = accountsToWithdrawFrom.slice(i, i + BATCH_SIZE);
      console.log(
        `\nProcessing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(
          accountsToWithdrawFrom.length / BATCH_SIZE
        )}`
      );
      console.log(`Batch size: ${batch.length} accounts`);

      try {
        const withdrawTokensSig = await withdrawWithheldTokensFromAccounts(
          connection,
          payer,
          taxedTokenMintAddress,
          destinationTokenAccount,
          withdrawWithheldAuthority,
          [],
          batch,
          undefined,
          taxedTokenProgramID
        );

        console.log(
          "💼 Batch withdrawal successful! Check transaction:",
          `\n🔗 https://solana.fm/tx/${withdrawTokensSig}?cluster=devnet-solana`
        );
        signatures.push(withdrawTokensSig);
      } catch (batchError) {
        console.error(
          `❌ Error processing batch ${i / BATCH_SIZE + 1}:`,
          batchError.message
        );
        // Continue with next batch even if current one fails
      }
    }

    return {
      signature: signatures,
      status: "success",
      totalBatches: Math.ceil(accountsToWithdrawFrom.length / BATCH_SIZE),
      successfulBatches: signatures.length,
    };
  } catch (error) {
    console.error("❌ Withdrawal failed:", error.message);
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
