const RippleAPI = require('ripple-lib').RippleAPI;
const promptly = require('promptly');
const util = require('util');
const EventEmitter = require('events');

const passwordPromptAsync = util.promisify(promptly.password);

class XrpRpc {
  constructor(config) {
    this.config = config;
    const {
      port,
      host,
      protocol,
      address
    } = config;
    const connectionString = `${protocol}://${host}:${port}`;
    this.rpc = new RippleAPI({
      server: connectionString
    });
    this.address = address;
    this.emitter = new EventEmitter();
  }

  async asyncCall(method, args) {
    return new Promise((resolve) => {
      this.rpc.connect().then(() => {
        return this.rpc[method](args).then((result) => {
          this.rpc.disconnect().then(() => {
            return resolve(result);
          });
        });
      });
    });
  }

  async asyncRequest(method, args) {
    return new Promise((resolve) => {
      this.rpc.connect().then(() => {
        return this.rpc.request(method, args).then((result) => {
          this.rpc.disconnect().then(() => {
            return resolve(result);
          });
        });
      });
    });
  }

  async unlockAndSendToAddress({ address, amount, secret }) {
    if (secret === undefined) {
      secret = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    return await this.sendToAddress({ address, amount, secret });
  }

  async sendToAddress({ address, amount, passphrase, tag, invoiceID, secret, alreadyConnected}) {
    return this.signTransaction({address, amount, passphrase, tag, invoiceID, secret}).then((signedTx) => {
      return this.submitSignedTransaction({ signedTx, alreadyConnected }).then((txHash) => {
        return txHash;
      });
    });
  }

  async getRawTransaction({ address, amount, tag, invoiceID, sourceAddress }) {
    const payment = {
      source: {
        address: sourceAddress,
        tag: tag || undefined,
        maxAmount: {
          value: amount.toString(),
          currency: this.config.currency
        }
      },
      destination: {
        address: address,
        tag: tag || undefined,
        amount: {
          value: amount.toString(),
          currency: this.config.currency
        }
      },
      invoiceID: invoiceID || undefined
    };
    await this.rpc.connect();
    let prepared = await this.rpc.preparePayment(sourceAddress, payment);
    await this.rpc.disconnect();
    return prepared;
  }

  async signTransaction({ address, amount, tag, invoiceID, secret, alreadyConnected }) {
    if (!secret) {
      throw new Error('Secret not provided');
    }
    let sourceAddress = this.rpc.deriveAddress(this.rpc.deriveKeypair(secret).publicKey);
    const payment = {
      source: {
        address: sourceAddress,
        tag: tag || undefined,
        maxAmount: {
          value: amount.toString(),
          currency: this.config.currency
        }
      },
      destination: {
        address: address,
        tag: tag || undefined,
        amount: {
          value: amount.toString(),
          currency: this.config.currency
        }
      },
      invoiceID: invoiceID || undefined
    };
    if (!alreadyConnected) {
      await this.rpc.connect();
    }
    return this.rpc.preparePayment(sourceAddress, payment).then(async (prepared) => {
      if (!alreadyConnected) {
        await this.rpc.disconnect();
      }
      const { signedTransaction } = this.rpc.sign(prepared.txJSON, secret);
      return signedTransaction;
    });
  }

  async submitSignedTransaction({ signedTx, alreadyConnected }) {
    if (!alreadyConnected) {
      await this.rpc.connect();
    }
    return this.rpc.submit(signedTx).then(async (response) => {
      if (!alreadyConnected) {
        await this.rpc.disconnect();
      }
      if (response.resultCode !== 'tesSUCCESS') {
        throw new Error('Failed to submit transaction.');
      }
      return response.tx_json.hash;
    });
  }

  async submitSignedTransactionMany({ signedTxArray }) {
    let resultArray = [];
    for (const signedTx of signedTxArray) {
      const emitData = { signedTx };
      try {
        let txHash = await this.submitSignedTransaction({ signedTx });
        emitData.txid = txHash;
        resultArray.push(emitData);
        this.emitter.emit('success', emitData);
      } catch (e) {
        emitData.error = e;
        resultArray.push(emitData);
        this.emitter.emit('failure', emitData);
      }
    }
    return resultArray;
  }

  async unlockAndSendToAddressMany({ payToArray, secret }) {
    if (secret === undefined) {
      secret = await passwordPromptAsync('> ');
    }

    const resultArray = [];
    await this.rpc.connect();
    for (const payment of payToArray) {
      const { address, amount, id } = payment;
      const emitData = { address, amount, id };
      this.emitter.emit('attempt', emitData);
      try {
        const txid = await this.sendToAddress({ address, amount, secret }, true);
        emitData.txid = txid;
        resultArray.push(emitData);
        this.emitter.emit('success', emitData);

        //do not await confirmations,
      } catch(e) {
        emitData.error = e;
        resultArray.push(emitData);
        this.emitter.emit('failure', emitData);
      }
    }
    await this.rpc.disconnect();
    return resultArray;
  }

  async estimateFee() {
    return await this.asyncCall('getFee');
  }

  async getBalance({ address }) {
    let balance =  await this.asyncCall('getBalances', this.address || address);
    let balanceAmount = balance.find((b) => (b.currency === this.config.currency)).value;
    return parseFloat(balanceAmount);
  }

  async getBestBlockHash() {
    let tip = await this.getTip();
    return tip.hash;
  }

  async getTransaction({ txid }) {
    const tx = await this.asyncRequest('tx', {transaction:txid});
    if (!tx) {
      return null;
    }
    tx.confirmations = await this.getConfirmations({ txid });
    return tx;
  }

  async getBlock({ hash }) {
    return this.asyncRequest('ledger', {
      ledger_hash: hash,
      transactions: true
    });
  }

  async getConfirmations({ txid }) {
    const tx = await this.asyncRequest('tx', {transaction:txid});
    if (!tx) {
      return null;
    }
    if (!tx.ledger_index) {
      return 0;
    }
    let tip = await this.getTip();
    let height = tip.height;
    return height - tx.ledger_index + 1; // Tip is considered confirmed
  }

  async getTip() {
    const blockchainInfo = await this.asyncRequest('ledger', {
      ledger_index: 'validated',
    });
    let height = blockchainInfo.ledger_index;
    let hash = blockchainInfo.ledger_hash;
    return { height, hash };
  }

  async validateAddress({ address }) {
    return this.rpc.isValidAddress(address);
  }
}

module.exports = XrpRpc;
