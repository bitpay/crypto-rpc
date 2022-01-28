const LndRPC = require('lightning');
const util = require('util');
const EventEmitter = require('events');

class LndRpc {
  constructor(config) {
    this.config = config;
    const {
      rpcPort: port,
      host,
      macaroon,
      cert
    } = config;
    const socket = host + ':' + port;
    this.rpc = LndRPC.authenticatedLndGrpc({ socket, macaroon, cert });
    this.emitter = new EventEmitter();
  }

  async getWalletInfo() {
    return LndRPC.getWalletInfo(this.rpc);
  }

  async getBalance() {
    const balanceInfo = await LndRPC.getChainBalance(this.rpc);
    return balanceInfo.chain_balance;
  }

  async getTransaction({ txid }) {
    const getInvoiceObject = { id: txid, ...this.rpc };
    return await LndRPC.getInvoice(getInvoiceObject);
  }

  async createInvoice({ id, amount, expiry }) {
    const { channels } = await LndRPC.getChannels(this.rpc);
    if (!channels.length) {
      throw new Error('No open channels to create invoice on');
    }
    return await LndRPC.createInvoice({ description: id, tokens: amount, expires_at: expiry, ...this.rpc });
  }

  async estimateFee({ nBlocks }) {
  }

  async getRawTransaction({ txid }) {
  }

  async decodeRawTransaction({ rawTx }) {
  }

  async getBlock({ hash, verbose = 1 }) {
  }

  async getBlockHash({ height }) {
  }

  async getConfirmations({ txid }) {
  }

  async getTip() {
  }
}

module.exports = LndRpc;
