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
      secret,
    } = config;
    const connectionString = `${protocol}://${host}:${port}`;
    //console.log(`Server: ${connectionString}`);
    this.rpc = new RippleAPI({
      server: connectionString,
    });
    this.connected = false;
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

  /*async cmdlineUnlock({ time }) {
    return this.asyncCall('cmdlineUnlock', [time]);
  }*/

  /*async sendMany({ account, batch, options }) {
    let batchClone = Object.assign({}, batch);
    for (let tx in batch) {
      batchClone[tx] /= 1e8;
    }
    if (!account) {
      account = '';
    }
    const paramArray = [account, batchClone];
    if (options) {
      paramArray.push(options);
    }
    return this.asyncCall('sendMany', paramArray);
  }*/

  async sendToAddress({ address, amount }) {
    return this.asyncCall('sendToAddress', [address, amount / 1e8]);
  }

  async unlockAndSendToAddress({ address, amount, passphrase }) {
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }
    console.warn('Unlocking for a single transaction.');
    const tx = await this.sendToAddress({ address, amount, passphrase });
    return tx;
  }

  async sendToAddress({ address, amount, passphrase, tag, secret }) {
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
      invoiceID: tag || undefined,
    };
    await this.rpc.connect();
    return this.rpc.preparePayment(sourceAddress, payment).then(async (prepared) => {
      const { signedTransaction } = this.rpc.sign(prepared.txJSON, secret);
      return this.rpc.submit(signedTransaction).then(async (response) => {
        /* Must ensure transaction confirms / validates using getTransaction later on.
         * Pending transactions will have status: 'success' & undefined meta field.
         * Validated (confirmed) transactions will have meta & validated: true.
         */
        await this.rpc.disconnect();
        if (response.resultCode !== 'tesSUCCESS') {
          return new Error('Failed to submit transaction.');
        }
        return response;
      });
    });
  }

  /*async unlockAndSendToAddressMany({ account, payToArray, passphrase, time = 10800, maxValue = 10*1e8, maxOutputs = 1 }) {
    let payToArrayClone = [...payToArray];
    if (passphrase === undefined) {
      passphrase = await passwordPromptAsync('> ');
    }
    await this.walletUnlock({ passphrase, time });
    let payToArrayResult = [];
    while (payToArrayClone.length) {
      let currentValue = 0;
      let currentOutputs = 0;
      let paymentsObj = {};
      let paymentsArr = [];
      if (payToArrayClone.length < maxOutputs) {
        maxOutputs = payToArrayClone.length;
      }
      while (currentValue < maxValue && currentOutputs < maxOutputs) {
        const {address, amount, id} = payToArrayClone.shift();
        paymentsArr.push({ address, amount, id });
        const emitAttempt = {
          address,
          amount,
          id
        };
        this.emitter.emit('attempt', emitAttempt);
        if (!paymentsObj[address]) {
          paymentsObj[address] = 0;
        }
        paymentsObj[address] += amount;
        currentValue += amount;
        currentOutputs++;
      }
      let emitData = {
        txid: '',
        vout: '',
        id: '',
        amount: '',
        address: '',
      };
      let txid;
      let txDetails;
      try {
        txid = await this.sendMany({ account, batch:paymentsObj });
        emitData.txid = txid;
      } catch (error) {
        emitData.error = error;
      }
      try {
        if (txid) {
          txDetails = await this.getTransaction({ txid });
        }
      } catch (error) {
        console.error(`Unable to get transaction details for txid: ${txid}.`);
        console.error(error);
      }
      for (let payment of paymentsArr) {
        if (txDetails && txDetails.vout) {
          for (let vout of txDetails.vout) {
            if (vout.scriptPubKey.addresses[0].includes(payment.address)) {
              emitData.vout = vout.n;
              payment.vout = emitData.vout;
            }
          }
        }
        emitData.id = payment.id;
        emitData.amount = payment.amount;
        emitData.address = payment.address;
        payment.txid = emitData.txid;
        if (emitData.error) {
          this.emitter.emit('failure', emitData);
          payment.error = emitData.error;
        } else {
          this.emitter.emit('success', emitData);
        }
        payToArrayResult.push(payment);
      }
    }
    await this.walletLock();
    this.emitter.emit('done');
    return payToArrayResult;
  }*/

  /*async walletUnlock({ passphrase, time }) {
    this.emitter.emit('unlocked', time );
    return this.asyncCall('walletPassPhrase', [passphrase, time]);
  }*/

  /*async walletLock() {
    this.emitter.emit('locked');
    return this.asyncCall('walletLock', []);
  }*/

  async estimateFee({ nBlocks }) {
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

  /*async getRawTransaction({ txid }) {
    try {
      return await this.asyncCall('getRawTransaction', [txid, 1]);
    } catch (err) {
      if (err.code === -5) {
        return null;
      }
      throw err;
    }
  }*/

  /*async sendRawTransaction({ rawTx }) {
    return this.asyncCall('sendRawTransaction', [rawTx]);
  }*/

  /*async decodeRawTransaction({ rawTx }) {
    return this.asyncCall('decodeRawTransaction', [rawTx]);
  }*/

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
