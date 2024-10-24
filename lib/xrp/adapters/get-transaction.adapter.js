/**
 * @typedef {Object} TxMetaData
 * @property {Array<Object>} AffectedNodes
 * @property {number} TransactionIndex
 * @property {string} TransactionResult - tesSUCCESS if tx successful
 * @property {string} delivered_amount
 */

/**
 * @typedef {Object} V4TxJson
 * @property {string} Account
 * @property {string} DeliverMax
 * @property {string} Destination
 * @property {string} Fee
 * @property {number} Flags
 * @property {number} LastLedgerSequence
 * @property {number} Sequence
 * @property {string} SigningPubKey
 * @property {string} TransactionType - 'Payment'
 * @property {string} TxnSignature
 * @property {number} date
 * @property {number} ledger_index
 */

/**
 * @typedef {Object} V4Transaction
 * @property {string} close_time_iso
 * @property {string} ctid
 * @property {string} hash
 * @property {string} ledger_hash
 * @property {number} ledger_index
 * @property {TxMetaData} meta
 * @property {V4TxJson} tx_json
 * @property {boolean} validated
 * @property {number} confirmations
 * @property {string} blockHash
 */

/**
 * @typedef {Object} V2Transaction
 * @property {string} Account
 * @property {string} Amount
 * @property {string} DeliverMax
 * @property {string} Destination
 * @property {string} Fee
 * @property {number} Flags
 * @property {number} LastLedgerSequence
 * @property {number} Sequence
 * @property {string} SigningPubKey
 * @property {string} TransactionType - 'Payment'
 * @property {string} TxnSignature
 * @property {string} ctid
 * @property {number} date
 * @property {string} hash
 * @property {number} inLedger
 * @property {number} ledger_index
 * @property {TxMetaData} meta
 * @property {boolean} validated
 * @property {number} confirmations
 * @property {string} blockHash
 */

/**
 * Adapt (augmented) xrpl v4 transaction to xrpl v2 transaction
 * @param {V4Transaction} v4Transaction
 * @returns {V2Transaction}
 */
export function getTransactionAdapter(v4Transaction) {
  const {
    // close_time_iso, // unused
    ctid,
    hash,
    // ledger_hash, // unused
    ledger_index,
    meta,
    tx_json,
    validated,
    confirmations,
    blockHash
  } = v4Transaction;

  const {
    Account,
    DeliverMax,
    Destination,
    Fee,
    Flags,
    LastLedgerSequence,
    Sequence,
    SigningPubKey,
    TransactionType,
    TxnSignature,
    date
  } = tx_json;

  return {
    Account,
    Amount: meta.delivered_amount,
    DeliverMax,
    Destination,
    Fee,
    Flags,
    LastLedgerSequence,
    Sequence,
    SigningPubKey,
    TransactionType,
    TxnSignature,
    ctid,
    date,
    hash,
    inLedger: ledger_index, // Assumption
    ledger_index,
    meta,
    validated,
    confirmations,
    blockHash
  };
}