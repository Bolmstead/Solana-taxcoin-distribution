const {
  TransactionExpiredBlockheightExceededError,
} = require("@solana/web3.js");
const promiseRetry = require("promise-retry");
const { wait } = require("./wait.js");

const SEND_OPTIONS = {
  skipPreflight: true,
};

/**
 * Sends and confirms a transaction with automatic retries and expiry handling
 * @param {Object} params - The parameters for sending and confirming the transaction
 * @param {Connection} params.connection - The Solana connection instance
 * @param {Buffer} params.serializedTransaction - The serialized transaction buffer
 * @param {Object} params.blockhashWithExpiryBlockHeight - The blockhash and expiry information
 * @param {string} params.blockhashWithExpiryBlockHeight.blockhash - The blockhash
 * @param {number} params.blockhashWithExpiryBlockHeight.lastValidBlockHeight - The last valid block height
 * @returns {Promise<Object|null>} The transaction response or null if expired
 */
async function transactionSenderAndConfirmationWaiter({
  connection,
  serializedTransaction,
  blockhashWithExpiryBlockHeight,
}) {
  const txid = await connection.sendRawTransaction(
    serializedTransaction,
    SEND_OPTIONS
  );

  const controller = new AbortController();
  const abortSignal = controller.signal;

  const abortableResender = async () => {
    while (true) {
      await wait(2_000);
      if (abortSignal.aborted) return;
      try {
        await connection.sendRawTransaction(
          serializedTransaction,
          SEND_OPTIONS
        );
      } catch (e) {
        console.warn(`Failed to resend transaction: ${e}`);
      }
    }
  };

  try {
    abortableResender();
    const lastValidBlockHeight =
      blockhashWithExpiryBlockHeight.lastValidBlockHeight;

    // this would throw TransactionExpiredBlockheightExceededError
    await Promise.race([
      connection.confirmTransaction(
        {
          ...blockhashWithExpiryBlockHeight,
          lastValidBlockHeight,
          signature: txid,
          abortSignal,
        },
        "confirmed"
      ),
      new Promise(async (resolve) => {
        // in case ws socket died
        while (!abortSignal.aborted) {
          await wait(2_000);
          const tx = await connection.getSignatureStatus(txid, {
            searchTransactionHistory: false,
          });
          if (tx?.value?.confirmationStatus === "confirmed") {
            resolve(tx);
          }
        }
      }),
    ]);
  } catch (e) {
    if (e instanceof TransactionExpiredBlockheightExceededError) {
      // we consume this error and getTransaction would return null
      return null;
    } else {
      // invalid state from web3.js
      throw e;
    }
  } finally {
    controller.abort();
  }

  // in case rpc is not synced yet, we add some retries
  const response = await promiseRetry(
    async (retry) => {
      const response = await connection.getTransaction(txid, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!response) {
        retry(response);
      }
      return response;
    },
    {
      retries: 5,
      minTimeout: 1000,
    }
  );

  return response;
}

module.exports = { transactionSenderAndConfirmationWaiter };
