const { PublicKey } = require('@solana/web3.js');
const bs58 = require('bs58');
const BN = require('bn.js');

const tx = {
  blockTime: 1741140003,
  meta: {
    computeUnitsConsumed: 150,
    err: null,
    fee: 5000,
    innerInstructions: [
    ],
    loadedAddresses: {
      readonly: [
      ],
      writable: [
      ],
    },
    logMessages: [
      "Program 11111111111111111111111111111111 invoke [1]",
      "Program 11111111111111111111111111111111 success",
    ],
    postBalances: [
      4988155560,
      15000053000,
      1,
    ],
    postTokenBalances: [
    ],
    preBalances: [
      4988170560,
      15000043000,
      1,
    ],
    preTokenBalances: [
    ],
    rewards: [
    ],
    status: {
      Ok: null,
    },
  },
  slot: 365177082,
  transaction: {
    message: {
      header: {
        numReadonlySignedAccounts: 0,
        numReadonlyUnsignedAccounts: 1,
        numRequiredSignatures: 1,
      },
      staticAccountKeys: [
        {
          _bn: {
            negative: 0,
            words: [
              10176991,
              43751707,
              26698954,
              29892699,
              21998419,
              8684056,
              10209879,
              33904079,
              33520190,
              753753,
              0,
            ],
            length: 10,
            red: null,
          },
        },
        {
          _bn: {
            negative: 0,
            words: [
              16530510,
              26717596,
              45804286,
              22960444,
              7189307,
              41397213,
              44491432,
              18989812,
              36345755,
              1175105,
              0,
            ],
            length: 10,
            red: null,
          },
        },
        {
          _bn: {
            negative: 0,
            words: [
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
            ],
            length: 1,
            red: null,
          },
        },
      ],
      recentBlockhash: "12d8r9EFSUpiybntdHiBaN9ZW19AFRiRrWz7HRJaoCHB",
      compiledInstructions: [
        {
          programIdIndex: 2,
          accountKeyIndexes: [
            0,
            1,
          ],
          data: new Uint8Array([2, 0, 0, 0, 16, 39, 0, 0, 0, 0, 0, 0]),
        },
      ],
      addressTableLookups: [
      ],
    },
    signatures: [
      "3TXYVduR863FYHx5qEdrjUWRiaTxZGzYDRgC85zNoU7PPHANEzi4qtinNQevtUdPV8pDMAVhZ4YcFE3BnGTXgNGv",
    ],
  },
  version: 0,
}

function parseTransaction(tx) {
    const accounts = tx.transaction.message.staticAccountKeys.map(({ _bn: bnObject }) => {
          // Create a proper BN instance from the serialized data
  const bn = new BN(bnObject.words.slice(0, bnObject.length), 10, 'le');
  
  // Convert to a Buffer (32 bytes)
  const buffer = bn.toArrayLike(Buffer, 'le', 16);
  
  // Create a PublicKey from the buffer
  const publicKey = new PublicKey(buffer);
  
  return publicKey.toString();
    });

    const accountBalances = accounts.map((address, index) => ({
        address,
        preBalance: tx.meta.preBalances[index],
        postBalance: tx.meta.postBalances[index]
    }));
    console.log(accountBalances);
};

(() => {
    parseTransaction(tx);
})()