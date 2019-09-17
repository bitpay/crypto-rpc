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
      address,
    } = config;
    const connectionString = `${protocol}://${host}:${port}`;
    //console.log(`Server: ${connectionString}`);
    this.rpc = new RippleAPI({
      server: connectionString,
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

  async unlockAndSendToAddress({ address, amount, passphrase }) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    return await this.sendToAddress({ address, amount, passphrase });
  }

  async sendToAddress({ address, amount, passphrase, tag, invoiceID, secret }, alreadyConnected = false) {
    if (passphrase && !secret) {
      secret = passphrase;
    }
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
          currency: 'XRP'
        }
      },
      destination: {
        address: address,
        tag: tag || undefined,
        amount: {
          value: amount.toString(),
          currency: 'XRP'
        }
      },
      invoiceID: invoiceID || undefined,
    };
    if (!alreadyConnected) {
      await this.rpc.connect();
    }
    return this.rpc.preparePayment(sourceAddress, payment).then(async (prepared) => {
      const { signedTransaction } = this.rpc.sign(prepared.txJSON, secret);
      return this.rpc.submit(signedTransaction).then(async (response) => {
        /* Must ensure transaction confirms / validates using getTransaction later on.
         * Pending transactions will have status: 'success' & undefined meta field.
         * Validated (confirmed) transactions will have meta & validated: true.
         */
        if (!alreadyConnected) {
          await this.rpc.disconnect();
        }
        if (response.resultCode !== 'tesSUCCESS') {
          return new Error('Failed to submit transaction.');
        }
        return response.tx_json.hash;
      });
    });
  }

  async unlockAndSendToAddressMany({ payToArray, passphrase}) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }

    const resultArray = [];
    await this.rpc.connect();
    for (const payment of payToArray) {
      const { address, amount, id } = payment;
      const emitData = { address, amount, id };
      this.emitter.emit('attempt', emitData);
      try {
        const txid = await this.sendToAddress({ address, amount, passphrase }, true);
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
    return resultArray;
  }

  async estimateFee() {
    return await this.asyncCall('getFee');
  }

  async getBalance({ address }) {
    let balance =  await this.asyncCall('getBalances', this.address || address);
    return balance.find((b) => (b.currency === 'XRP')).value;
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
    return tx;
  }

  async getBlock({ hash }) {
    return this.asyncRequest('ledger', {
      ledger_hash: hash,
      transactions: true,
    });
  }

  async getConfirmations({ txid }) {
    const tx = await this.asyncRequest('tx', {transaction:txid});
    if (!tx) {
      return null;
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
