const Lightning = require('lightning');
const EventEmitter = require('events');

class LndRpc {
  constructor(config) {
    this.config = config;
    const {
      rpcPort: port,
      host,
      macaroon,
      cert,
    } = config;
    const socket = host + ':' + port;
    this.rpc = Lightning.authenticatedLndGrpc({ socket, macaroon, cert });
    this.unauthenticatedRpc = Lightning.unauthenticatedLndGrpc({ socket, cert });
    this.emitter = new EventEmitter();
  }

  /**
   * Call any method in the lightning library
   * @param {String} method method in the lightning library to call
   * @param {Array} args array with an object that contains all of the params
   * @param {Boolean} unauthenticated use the unauthenticated rpc (default will use authenticated)
   * @returns {Promise} calls the lightning library method and resolves on success
   */
  async asyncCall(method, args, unauthenticated) {
    let params = args ? args[0] : {};
    params = unauthenticated ? { ...params, ...this.unauthenticatedRpc } : { ...params, ...this.rpc };
    try {
      return await Lightning[method](params);
    } catch (err) {
      console.error(err);
      if (err.message.includes('TypeError')) {
        return Lightning[method](params);
      } else {
        err.conclusive = true; // used by server
        throw err;
      }
    }
  }

  async getWalletInfo() {
    return Lightning.getWalletInfo(this.rpc);
  }

  async getBalance() {
    const balanceInfo = await Lightning.getChainBalance(this.rpc);
    return balanceInfo.chain_balance;
  }

  async getTransaction({ txid }) {
    const getInvoiceObject = { id: txid, ...this.rpc };
    return await Lightning.getInvoice(getInvoiceObject);
  }

  async createInvoice({ id, amount, expiry }) {
    const { channels } = await Lightning.getChannels(this.rpc);
    if (!channels.length) {
      throw new Error('No open channels to create invoice on');
    }
    return await Lightning.createInvoice({ description: id, tokens: amount, expires_at: expiry, ...this.rpc });
  }

  async walletCreate({ passphrase }) {
    const { seed } = await Lightning.createSeed(this.unauthenticatedRpc);
    await Lightning.createWallet({ seed, password: passphrase, ...this.unauthenticatedRpc });
  }

  async walletUnlock({ passphrase }) {
    await Lightning.unlockWallet({ ...this.unauthenticatedRpc, password: passphrase });
  }

  async getBTCAddress({ format='p2wpkh' }) {
    return await Lightning.createChainAddress({format, ...this.rpc});
  }

  async createNewAuthenticatedRpc({ cert, macaroon, rpcPort, host }) {
    const socket = host + ':' + rpcPort;
    this.rpc = Lightning.authenticatedLndGrpc({ socket, macaroon, cert });
  }

  async openChannel({ amount, pubkey, socket }) {
    return await Lightning.openChannel({
      ...this.rpc,
      local_tokens: amount,
      partner_public_key: pubkey,
      partner_socket: socket
    });
  }

  async subscribeToInvoices() {
    return Lightning.subscribeToInvoices(this.rpc);
  }

  async getTip() {
    return await Lightning.getNetworkInfo(this.rpc);
  }

  async getBestBlockHash() {
    const height = await Lightning.getHeight(this.rpc);
    return height.current_block_height;
  }

  async estimateFee() {
    return await Lightning.getFeeRates(this.rpc);
  }
}

module.exports = LndRpc;
