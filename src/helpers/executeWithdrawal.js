const { Keypair, clusterApiUrl } = require("@solana/web3.js");
const {
  TOKEN_2022_PROGRAM_ID,
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
} = require("../config/solana.js");
const dotenv = require("dotenv");
const bs58 = require("bs58").default;
dotenv.config();

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
  const allAccounts = await connection.getProgramAccounts(
    TOKEN_2022_PROGRAM_ID,
    {
      commitment: "confirmed",
      filters: [
        {
          memcmp: {
            offset: 0,
            bytes: taxedTokenMintAddress.toString(),
          },
        },
      ],
    }
  );
  console.log("📊 Total accounts found:", allAccounts.length);

  const accountsToWithdrawFrom = [];

  console.log("🔎 Analyzing accounts for withheld fees...");
  for (const accountInfo of allAccounts) {
    try {
      const account = unpackAccount(
        accountInfo.pubkey,
        accountInfo.account,
        TOKEN_2022_PROGRAM_ID
      );

      // We then extract the transfer fee extension data from the account
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

  console.log("🚀 Initiating withdrawal transaction...");
  try {
    // First try withdrawing from the mint
    console.log("Attempting to withdraw from mint...");
    console.log("🚕 payer:: ", payer);
    console.log("🚕 taxedTokenMintAddress:: ", taxedTokenMintAddress);
    console.log("🚕 recipientKeypair.publicKey:: ", recipientKeypair.publicKey);
    console.log(
      "🚕 withdrawWithheldAuthority:: ",
      withdrawWithheldAuthority.publicKey
    );
    console.log("🚕 destinationTokenAccount:: ", destinationTokenAccount);

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

    // Then try withdrawing from accounts
    console.log("\nAttempting to withdraw from accounts...");
    const withdrawTokensSig = await withdrawWithheldTokensFromAccounts(
      connection,
      payer,
      taxedTokenMintAddress,
      destinationTokenAccount,
      withdrawWithheldAuthority,
      [],
      accountsToWithdrawFrom,
      undefined,
      TOKEN_2022_PROGRAM_ID
    );

    console.log(
      "💼 Account withdrawal successful! Check transaction:",
      `\n🔗 https://solana.fm/tx/${withdrawTokensSig}?cluster=devnet-solana`
    );
    return {
      signature: withdrawTokensSig,
      status: "success",
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

  // Optionally - you can also withdraw withheld tokens from the mint itself
  // see ReadMe for the difference

  // await withdrawWithheldTokensFromMint(
  //   connection, // connection to use
  //   payer, // payer of the transaction fee
  //   mint, // the token mint
  //   recipientKeypair.publicKey, // the destination account
  //   withdrawWithheldAuthority, // the withdraw withheld authority
  //   [], // signing accounts
  //   undefined, // options for confirming the transaction
  //   TOKEN_2022_PROGRAM_ID // SPL token program id
  // );
}

module.exports = {
  executeTaxWithdrawal,
};
