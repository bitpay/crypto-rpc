const xrpl = require('xrpl');

const SUPPORTED_TRANSACTION_TYPES = new Set(['payment']);
// https://xrpl.org/docs/references/protocol/transactions/transaction-results
const SUPPORTED_TRANSACTION_RESULT_CODES = {
    // The transaction failed, but it was applied to a ledger to apply the transaction cost
    // tec: {
    //     AMM_ACCOUNT: 'tecAMM_ACCOUNT',
    //     AMM_UNFUNDED: 'tecAMM_UNFUNDED',
    //     AMM_BALANCE: 'tecAMM_BALANCE',
    //     AMM_EMPTY: 'tecAMM_EMPTY',
    //     AMM_FAILED: 'tecAMM_FAILED',
    //     AMM_INVALID_TOKENS: 'tecAMM_INVALID_TOKENS',
    //     AMM_NOT_EMPTY: 'tecAMM_NOT_EMPTY',
    //     CANT_ACCEPT_OWN_NFTOKEN_OFFER: 'tecCANT_ACCEPT_OWN_NFTOKEN_OFFER',
    //     CLAIM: 'tecCLAIM',
    //     CRYPTOCONDITION_ERROR: 'tecCRYPTOCONDITION_ERROR',
    //     DIR_FULL: 'tecDIR_FULL',
    //     DUPLICATE: 'tecDUPLICATE',
    //     DST_TAG_NEEDED: 'tecDST_TAG_NEEDED',
    //     EMPTY_DID: 'tecEMPTY_DID',
    //     EXPIRED: 'tecEXPIRED',
    //     FAILED_PROCESSING: 'tecFAILED_PROCESSING',
    //     FROZEN: 'tecFROZEN',
    //     HAS_OBLIGATIONS: 'tecHAS_OBLIGATIONS',
    //     INSUF_RESERVE_LINE: 'tecINSUF_RESERVE_LINE',
    //     INSUF_RESERVE_OFFER: 'tecINSUF_RESERVE_OFFER',
    //     INSUFF_FEE: 'tecINSUFF_FEE',
    //     INSUFFICIENT_FUNDS: 'tecINSUFFICIENT_FUNDS',
    //     INSUFFUCIENT_PAYMENT: 'tecINSUFFUCIENT_PAYMENT',
    //     INSUFFICIENT_RESERVE: 'tecINSUFFICIENT_RESERVE',
    //     INTERNAL: 'tecINTERNAL',
    //     INVARIANT_FAILED: 'tecINVARIANT_FAILED',
    //     KILLED: 'tecKILLED',
    //     MAX_SEQUENCE_REACHED: 'tecMAX_SEQUENCE_REACHED',
    //     NEED_MASTER_KEY: 'tecNEED_MASTER_KEY',
    //     NFTOKEN_BUY_SELL_MISMATCH: 'tecNFTOKEN_BUY_SELL_MISMATCH',
    //     NFTOKEN_OFFER_TYPE_MISMATCH: 'tecNFTOKEN_OFFER_TYPE_MISMATCH',
    //     NO_ALTERNATIVE_KEY: 'tecNO_ALTERNATIVE_KEY',
    //     NO_AUTH: 'tecNO_AUTH',
    //     NO_DST: 'tecNO_DST',
    //     NO_DST_INSUF_XRP: 'tecNO_DST_INSUF_XRP',
    //     NO_ENTRY: 'tecNO_ENTRY',
    //     NO_ISSUER: 'tecNO_ISSUER',
    //     NO_LINE: 'tecNO_LINE',
    //     NO_LINE_INSUF_RESERVE: 'tecNO_LINE_INSUF_RESERVE',
    //     NO_LINE_REDUNDANT: 'tecNO_LINE_REDUNDANT',
    //     NO_PERMISSION: 'tecNO_PERMISSION',
    //     NO_REGULAR_KEY: 'tecNO_REGULAR_KEY',
    //     NO_SUITABLE_NFTOKEN_PAGE: 'tecNO_SUITABLE_NFTOKEN_PAGE',
    //     NO_TARGET: 'tecNO_TARGET',
    //     OBJECT_NOT_FOUND: 'tecOBJECT_NOT_FOUND',
    //     OVERSIZE: 'tecOVERSIZE',
    //     OWNERS: 'tecOWNERS',
    //     PATH_DRY: 'tecPATH_DRY',
    //     PATH_PARTIAL: 'tecPATH_PARTIAL',
    //     TOO_SOON: 'tecTOO_SOON',
    //     UNFUNDED: 'tecUNFUNDED',
    //     UNFUNDED_ADD: 'tecUNFUNDED_ADD',
    //     UNFUNDED_PAYMENT: 'tecUNFUNDED_PAYMENT',
    //     UNFUNDED_OFFER: 'tecUNFUNDED_OFFER',
    // },
    // Indicate that the transaction failed and was not included in a ledger, but the transaction could have succeeded in some theoretical ledger
    // tef: {
    //     ALREADY: 'tefALREADY',
    //     BAD_ADD_AUTH: 'tefBAD_ADD_AUTH',
    //     BAD_AUTH: 'tefBAD_AUTH',
    //     BAD_AUTH_MASTER: 'tefBAD_AUTH_MASTER',
    //     BAD_LEDGER: 'tefBAD_LEDGER',
    //     BAD_QUORUM: 'tefBAD_QUORUM',
    //     BAD_SIGNATURE: 'tefBAD_SIGNATURE',
    //     CREATED: 'tefCREATED',
    //     EXCEPTION: 'tefEXCEPTION',
    //     FAILURE: 'tefFAILURE',
    //     INTERNAL: 'tefINTERNAL',
    //     INVARIANT_FAILED: 'tefINVARIANT_FAILED',
    //     MASTER_DISABLED: 'tefMASTER_DISABLED',
    //     MAX_LEDGER: 'tefMAX_LEDGER',
    //     NFTOKEN_IS_NOT_TRANSFERABLE: 'tefNFTOKEN_IS_NOT_TRANSFERABLE',
    //     NO_AUTH_REQUIRED: 'tefNO_AUTH_REQUIRED',
    //     NO_TICKET: 'tefNO_TICKET',
    //     NOT_MULTI_SIGNING: 'tefNOT_MULTI_SIGNING',
    //     PAST_SEQ: 'tefPAST_SEQ',
    //     TOO_BIG: 'tefTOO_BIG',
    //     WRONG_PRIOR: 'tefWRONG_PRIOR',
    // },
    // Error in the local server processing the transaction
    // tel: {
    //     BAD_DOMAIN: 'telBAD_DOMAIN',
    //     BAD_PATH_COUNT: 'telBAD_PATH_COUNT',
    //     BAD_PUBLIC_KEY: 'telBAD_PUBLIC_KEY',
    //     CAN_NOT_QUEUE: 'telCAN_NOT_QUEUE',
    //     CAN_NOT_QUEUE_BALANCE: 'telCAN_NOT_QUEUE_BALANCE',
    //     CAN_NOT_QUEUE_BLOCKS: 'telCAN_NOT_QUEUE_BLOCKS',
    //     CAN_NOT_QUEUE_BLOCKED: 'telCAN_NOT_QUEUE_BLOCKED',
    //     CAN_NOT_QUEUE_FEE: 'telCAN_NOT_QUEUE_FEE',
    //     CAN_NOT_QUEUE_FULL: 'telCAN_NOT_QUEUE_FULL',
    //     FAILED_PROCESSING: 'telFAILED_PROCESSING',
    //     INSUF_FEE_P: 'telINSUF_FEE_P',
    //     LOCAL_ERROR: 'telLOCAL_ERROR',
    //     NETWORK_ID_MAKES_TX_NON_CANONICAL: 'telNETWORK_ID_MAKES_TX_NON_CANONICAL',
    //     NO_DST_PARTIAL: 'telNO_DST_PARTIAL',
    //     REQUIRES_NETWORK_ID: 'telREQUIRES_NETWORK_ID',
    //     WRONG_NETWORK: 'telWRONG_NETWORK',
    // },
    // The transaction was malformed & cannot succeed according to the XRP Ledger protocol
    // tem: {
    //     BAD_AMM_TOKENS: 'temBAD_AMM_TOKENS',
    //     BAD_AMOUNT: 'temBAD_AMOUNT',
    //     BAD_AUTH_MASTER: 'temBAD_AUTH_MASTER',
    //     BAD_CURRENCY: 'temBAD_CURRENCY',
    //     BAD_EXPIRATION: 'temBAD_EXPIRATION',
    //     BAD_FEE: 'temBAD_FEE',
    //     BAD_ISSUER: 'temBAD_ISSUER',
    //     BAD_LIMIT: 'temBAD_LIMIT',
    //     BAD_NFTOKEN_TRANSFER_FEE: 'temBAD_NFTOKEN_TRANSFER_FEE',
    //     BAD_OFFER: 'temBAD_OFFER',
    //     BAD_PATH: 'temBAD_PATH',
    //     BAD_PATH_LOOP: 'temBAD_PATH_LOOP',
    //     BAD_SEND_XRP_LIMIT: 'temBAD_SEND_XRP_LIMIT',
    //     BAD_SEND_XRP_MAX: 'temBAD_SEND_XRP_MAX',
    //     BAD_SEND_XRP_NO_DIRECT: 'temBAD_SEND_XRP_NO_DIRECT',
    //     BAD_SEND_XRP_PARTIAL: 'temBAD_SEND_XRP_PARTIAL',
    //     BAD_SEND_XRP_PATHS: 'temBAD_SEND_XRP_PATHS',
    //     BAD_SEQUENCE: 'temBAD_SEQUENCE',
    //     BAD_SIGNATURE: 'temBAD_SIGNATURE',
    //     BAD_SRC_ACCOUNT: 'temBAD_SRC_ACCOUNT',
    //     BAD_TRANSFER_RATE: 'temBAD_TRANSFER_RATE',
    //     CANNOT_PREAUTH_SELF: 'temCANNOT_PREAUTH_SELF',
    //     DST_IS_SRC: 'temDST_IS_SRC',
    //     DST_NEEDED: 'temDST_NEEDED',
    //     INVALID: 'temINVALID',
    //     INVALID_COUNT: 'temINVALID_COUNT',
    //     INVALID_FLAG: 'temINVALID_FLAG',
    //     MALFORMED: 'temMALFORMED',
    //     REDUNDANT: 'temREDUNDANT',
    //     RIPPLE_EMPTY: 'temRIPPLE_EMPTY',
    //     BAD_WEIGHT: 'temBAD_WEIGHT',
    //     BAD_SIGNER: 'temBAD_SIGNER',
    //     BAD_QUORUM: 'temBAD_QUORUM',
    //     UNCERTAIN: 'temUNCERTAIN',
    //     UNKNOWN: 'temUNKNOWN',
    //     DISABLED: 'temDISABLED',
    // },
    // The transaction has not been applied yet, and generally will be automatically retried by the server that returned the result code
    // ter: {
    //     INSUF_FEE_B: 'terINSUF_FEE_B',
    //     NO_ACCOUNT: 'terNO_ACCOUNT',
    //     NO_AMM: 'terNO_AMM',
    //     NO_AUTH: 'terNO_AUTH',
    //     NO_LINE: 'terNO_LINE',
    //     NO_RIPPLE: 'terNO_RIPPLE',
    //     OWNERS: 'terOWNERS',
    //     PRE_SEQ: 'terPRE_SEQ',
    //     PRE_TICKET: 'terPRE_TICKET',
    //     QUEUED: 'terQUEUED',
    //     RETRY: 'terRETRY',
    //     SUBMITTED: 'terSUBMITTED',
    // },
    // A transaction succeeded
    tes: {
        SUCCESS: 'tesSUCCESS'
    }
};


/**
 * This adapter is used to adapt the new XRP client provided by the xrplv2 dependency
 * so that it will behave like the old XRP client provided by ripple-libv1
 * 
 * Migration guide: https://xrpl.org/docs/references/xrpljs2-migration-guide
 * ripple-lib ref: https://github.com/XRPLF/xrpl.js/blob/1.x/docs/index.md
 */
class XrpClientAdapter extends xrpl.Client {
    async getLedger({ ledgerVersion }) {
        return await this.request({
            command: 'ledger',
            ledger_index: ledgerVersionLimit
        })
    };

    /**
     * Retrieves transactions based on the provided parameters.
     *
     * @param {string} acceptanceAddress - The address of the account to get transactions for.
     * @param {Object} options - The options for retrieving transactions.
     * @param {number} [options.minLedgerVersion] - Return only transactions in this ledger version or higher.
     * @param {number} [options.maxLedgerVersion] - Return only transactions in this ledger version or lower.
     * @param {Array<string>} [options.types] - Only return transactions of the specified Transaction Types (see SUPPORTED_TRANSACTION_TYPES).
     * @param {boolean} [options.initiated] - If true, return only transactions initiated by the account specified by acceptanceAddress. If false, return only transactions NOT initiated by the account specified by acceptanceAddress.
     * @param {boolean} [options.includeRawTransactions] - Include raw transaction data. For advanced users; exercise caution when interpreting this data.
     * @param {boolean} [options.excludeFailures] - If true, the result omits transactions that did not succeed.
     * @returns {Promise<Array>} A promise that resolves to an array of transactions.
     */
    async getTransactions(acceptanceAddress, {
        minLedgerVersion,
        maxLedgerVersion,
        types,
        initiated,
        includeRawTransactions,
        excludeFailures
    }) {
        /**
         * Behavior defaults to 'true', but this error is to document that 'includeRawTransactions: false' is NOT supported
         * Truthiness is not sufficient for this check - it must explicitly be an equality check, & strict equality is prefered
         */
        if (includeRawTransactions === false) {
            throw new Error('"includeRawTransactions: false" not supported');
        }

        /**
         * Filtering constants with defaults
         */
        const TYPES = Array.isArray(types) ? 
            types.reduce(( acc, cur ) => {
                const type = cur.toLowerCase();
                if (SUPPORTED_TRANSACTION_TYPES.has(type)) {
                    acc.push(type);
                };
                return acc;
            }, [])
            : SUPPORTED_TRANSACTION_TYPES;
        // Boolean option checks must be checked against type for existence instead of using fallback assignment
        const INITIATED = typeof initiated === 'boolean' ? initiated : false;
        const EXCLUDE_FAILURES = typeof excludeFailures === 'boolean' ? excludeFailures : true;
        const INCLUDE_RAW_TRANSACTIONS = typeof includeRawTransactions === 'boolean' ? includeRawTransactions : true;

        const { result } = await this.request({
            command: 'account_tx',
            account: acceptanceAddress,
            ledger_index_min: minLedgerVersion,
            ledger_index_max: maxLedgerVersion
        });

        if (!(result && Array.isArray(result.transactions))) {
            throw new Error('xrpl client request did not return expected form')
        };

        const filteredTransactions = result.transactions.filter(({ meta, tx }) => {
            /**
             * Filter transaction type
             */
            const { Account: initiatingAccount, TransactionType } = tx;
            if (!TYPES.includes(TransactionType.toLowerCase())) {
                return false;
            }

            /**
             * Filter on INITIATED.
             * If true, return only transactions initiated by the account specified by acceptanceAddress.
             * If false, return only transactions NOT initiated by the account specified by acceptanceAddress.
             */
            const isTxInitiatedByAcceptanceAddress = initiatingAccount === acceptanceAddress
            // XOR(INITIATED, isTxInitiatedByAcceptanceAddress)
            if (INITIATED !== isTxInitiatedByAcceptanceAddress) {
                return false;
            }

            /**
             * Filter on EXCLUDE_FAILURES
             */
            if (EXCLUDE_FAILURES && meta.TransactionResult !== SUPPORTED_TRANSACTION_RESULT_CODES.tes.SUCCESS) {
                return false;
            }

            return true;
        });

        return filteredTransactions.map(fTx => {
            // Only 'INCLUDE_RAW_TRANSACTIONS: true' is supported - the ternary w/ false case are just here for future expansion
            return INCLUDE_RAW_TRANSACTIONS ? { rawTransaction: JSON.stringify(fTx) } : fTx;
        });
    };
}

module.exports = XrpClientAdapter;

// Find examples of response at https://xrpl.org/docs/references/http-websocket-apis/public-api-methods/account-methods/account_tx