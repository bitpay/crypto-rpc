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

  // this will only work on ERC20 tokens with decimals
  async sendToAddress({ address, amount, fromAccount, passphrase, gasPrice, nonce, gas }) {
    if (!gasPrice) {
      gasPrice = await this.estimateGasPrice();
    }
    const account = fromAccount || await this.getAccount();
    const amountStr = Number(amount).toLocaleString('fullwide', { useGrouping: false });
    const contractData = this.erc20Contract.methods
      .transfer(address, amountStr)
      .encodeABI();

    if (passphrase) {
      this.emitter.emit('unlockedForOne');
    }

    let result;
    try {
      result = await this.web3.eth.personal.sendTransaction(
        {
          from: account,
          gasPrice,
          data: contractData,
          to: this.tokenContractAddress,
          nonce,
          gas
        },
        passphrase
      );

      if (passphrase) {
        this.emitter.emit('locked');
      }
    } catch (error) {
      this.emitter.emit('locked');
      throw new Error(error);
    }

    return result;
  }

  async getBalance({ address }) {
    if (address) {
      const balance = await this.erc20Contract.methods
        .balanceOf(address)
        .call();
      return balance;
    } else {
      const accounts = await this.web3.eth.getAccounts();
      const balances = [];
      for (let account of accounts) {
        const balance = await this.getBalance({ address: account });
        balances.push({ account, balance });
      }
      return balances;
    }
  }

  async decodeRawTransaction({ rawTx }) {
    const decodedEthTx = await super.decodeRawTransaction({ rawTx });
    if (decodedEthTx.data) {
      try {
        const erc20Interface = new ethers.utils.Interface(erc20);
        decodedEthTx.decodedData = await erc20Interface.parseTransaction({ data: decodedEthTx.data });
      } catch (err) {
        decodedEthTx.decodedData = undefined;
      }
    }
    return decodedEthTx;
  }
}

module.exports = Erc20RPC;
