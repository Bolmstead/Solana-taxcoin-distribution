const bs58 = require("bs58");
const { Transaction, VersionedTransaction } = require("@solana/web3.js");

/**
 * Gets the signature from a transaction
 * @param {Transaction|VersionedTransaction} transaction - The transaction to get the signature from
 * @returns {string} The base58 encoded signature
 * @throws {Error} If the transaction is not signed by the fee payer
 */
function getSignature(transaction) {
  const signature =
    "signature" in transaction
      ? transaction.signature
      : transaction.signatures[0];
  if (!signature) {
    throw new Error(
      "Missing transaction signature, the transaction was not signed by the fee payer"
    );
  }
  return bs58.encode(signature);
}

module.exports = { getSignature };
