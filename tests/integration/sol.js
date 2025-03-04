const { createKeyPairSignerFromPrivateKeyBytes, getBase58Encoder } = require("@solana/web3.js");
const bs58 = require("bs58");

const config = {
    chain: 'SOL',
    host: 'api.devnet.solana.com',
    protocol: 'https',
    currencyConfig: {
        privateKey1: 'H6x8RRKJ9xBx71N8wn8USBghwApSqHP7A9LT5Mxo6rP9',
        privateKey2: 'CVFoRgAv6LNQvX6EmPeqGjgUDZYvjHgqbXve4rus4o63'
    }
}

describe('SolRpc Integration tests', () => {
    /** @type {import("@solana/web3.js").KeyPairSigner<string>} */
    let keypairSigner1;
    /** @type {import("@solana/web3.js").KeyPairSigner<string>} */
    let keypairSigner2;

    before(async () => {
        const bs58Encoder = getBase58Encoder();
        const [keypairSigner1Value, keypairSigner2Value] = await Promise.all(
            Object.values(config.currencyConfig)
                .map(async (key) => { return await createKeyPairSignerFromPrivateKeyBytes(bs58Encoder.encode(key)) })
        );
        keypairSigner1 = keypairSigner1Value;
        keypairSigner2 = keypairSigner2Value;
    });

    describe('constructor', () => {
        it('can be constructed with valid configuration', async () => {})
    })

    describe('getBalance', () => {
        it('can retrieve a balance number for a valid address', async () => {})
        it('returns null for an invalid address', async () => {
            const invalidAddress = 'Address not on curve';
        })
    })

    describe('sendToAddress', () => {
        it('can send a valid versioned transaction without nonce and without priority fee', async () => {})
        it('can send a valid versioned transaction with nonce and without priority fee', async () => {})
        it('can send a valid versioned transaction without nonce and with priority fee', async () => {})
        it('can send a valid versioned transaction with nonce and with priority fee', async () => {})
        it('can send a valid legacy transaction without nonce and without priority fee', async () => {})
        it('can send a valid legacy transaction with nonce and without priority fee', async () => {})
        it('can send a valid legacy transaction without nonce and with priority fee', async () => {})
        it('can send a valid legacy transaction with nonce and with priority fee', async () => {})
    })

    describe('createNonceAccount', () => {
        it('can create a nonce account ', async () => {
            // This tests whether the nonce account can be created and then retrieves the nonce
        })
        it('throws an error if the fee payer/nonce authority input is incorrect', async () => {})
        it('throws an error if the nonce account input is incorrect', async () => {})
    })

    describe('estimateFee', () => {
        it('calls estimateTransacitonFee is rawTx is included and returns number if rawTx is valid', async () => {})
        it('throws "Could not decode provided raw transaction" error if rawTx cannot be decoded', async () => {})
        it('returns a number based on the average fee calculator for the last n blocks', async () => {})
    })

    describe('estimateTransactionFee', () => {
        it('returns a fee estimate number in lamports based on the latest blockhash and transaction message', async () => {})
        it('throws "Could not decode provided raw transaction" if input could not be retrieved', async () => {})
    })

    describe('estimateMaxPriorityFee', () => {
        it('returns a number representing the priority fee at the nth percentile of ordered recent prioritization fees', async () => {})
    })

    describe('addPriorityFee', () => {
        it('adds a priority fee to the provided transaction message', async () => {})
    })

    describe('getBestBlockHash', () => {
        it('returns a blockhash', async () => {})
    })

    describe('getTransaction', () => {
        it('returns a transaction if provided a valid transaction id', async () => {
            // may want to think about this._versionedConfig & its commitment level

            // IMPORTANT! The shape of the data
        })
    })

    describe('getTransactions', () => {
        it('returns an array of at most 1000 non-null transactions for a specified address', async () => {
            // Consider generating a new address here...

            // For each tx, check shape
        })
    })

    describe('getTransactionCount', () => {
        it('returns the count of confirmed transactions for a valid account address', () => {})
        it('returns null for an invalid address', async () => {})
    })

    describe('getRawTransaction', () => {
        it('returns a base64 encoded string for a valid transaction', async () => {})
    })

    describe('decodeRawTransaction', () => {
        it('returns a decoded raw transaction', () => {})
    })

    describe('sendRawTransaction', () => {
        it('sends a raw transaction', async () => {
            // Check transaction on blockchain to ensure its sent

            // What's the return supposed to be - the transaction signature?
        })
    })

    describe('getBlock', () => {
        it('returns a block at provided height', async () => {})
    })

    describe('getConfirmations', () => {
        it('returns the number of confirmations for a valid txid', async () => {
            // Create the tx
            // Check monotonic increasing number of confirmations over time
        })
    })

    describe('getTip', () => {
        it('returns the slot number as "height" and the corresponding block at that height', async () => {
            // Check block formatting
        })
    })

    describe('getServerInfo', () => {
        it('returns server info', async () => {
            // shape is important here
        })
    })

    describe('isBase58', () => {
        it('returns true if a string is valid base58', () => {})
        it('returns false if a string is invalid base58', () => {})
    })
})