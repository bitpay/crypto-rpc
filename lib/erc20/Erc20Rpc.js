const EthRPC = require('../eth/EthRpc');
const erc20 = require('./erc20.json');
const ethers = require('ethers');

class Erc20RPC extends EthRPC {
  constructor(config) {
    super(config);
    this.tokenContractAddress = config.tokenContractAddress;
    this.erc20Contract = new this.web3.eth.Contract(
      erc20,
      this.tokenContractAddress
    );
  }

  #getWallet(account) {
    return this.web3.eth.accounts.wallet.get(account);
  }

  // this will only work on ERC20 tokens with decimals
  async sendToAddress({ address, amount, fromAccount, gasPrice, nonce, gas }) {
    if (!gasPrice) {
      gasPrice = await this.estimateGasPrice();
    }
    const account = fromAccount || this.getAccount();
    const amountStr = Number(amount).toLocaleString('fullwide', { useGrouping: false });
    const contractData = this.erc20Contract.methods
      .transfer(address, amountStr)
      .encodeABI();

    const wallet = this.#getWallet(account);
    if (!wallet) {
      throw new Error('Account not found. Make sure you add it first with addAccount()');
    }
  
    try {
      const signed = await wallet.signTransaction({
        from: account,
        gasPrice,
        data: contractData,
        to: this.tokenContractAddress,
        nonce,
        gas
      });
      const txid = await new Promise((resolve, reject) => 
        this.web3.eth.sendSignedTransaction(signed.rawTransaction).on('transactionHash', resolve).on('error', reject)
      );

      return txid;
    } catch (error) {
      throw new Error(error);
    }
  }

  async getBalance({ address }) {
    if (address) {
      const balance = await this.erc20Contract.methods
        .balanceOf(address)
        .call();
      return balance;
    } else {
      const wallets = await this.web3.eth.accounts.wallet;
      const balances = [];
      for (const wallet of wallets) {
        const balance = await this.getBalance({ address: wallet.address });
        balances.push({ account: wallet.address, balance });
      }
      return balances;
    }
  }

  async decodeRawTransaction({ rawTx }) {
    const decodedEthTx = await super.decodeRawTransaction({ rawTx });
    if (decodedEthTx.data) {
      try {
        const erc20Interface = new ethers.Interface(erc20);
        decodedEthTx.decodedData = await erc20Interface.parseTransaction({ data: decodedEthTx.data });
      } catch (err) {
        decodedEthTx.decodedData = undefined;
      }
    }
    return decodedEthTx;
  }
}

module.exports = Erc20RPC;
