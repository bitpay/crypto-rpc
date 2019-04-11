const SendToMany = artifacts.require('SendToMany');
const CryptoErc20 = artifacts.require('CryptoErc20');
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
contract('SendToMany', (accounts) => {
  it('should exist', async() => {
    const batcher = await SendToMany.deployed();
    assert(batcher);
  });

  it('should send ether', async() => {
    const batcher = await SendToMany.deployed();
    const receivers = accounts.slice(1);
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const balanceBefore = await web3.eth.getBalance(accounts[0]);;
    console.log('Token balance before', balanceBefore.toString());
    const sum = (1e18*receivers.length).toString();
    await batcher.sendMany(receivers, amounts, ZERO_ADDR, {value: sum});
    const balanceAfter = await web3.eth.getBalance(accounts[0]);;
    console.log('ETH balance after', balanceAfter.toString());
    for(const receiver of receivers) {
      const balance = await web3.eth.getBalance(receiver);
      console.log('ETH Balance', receiver, ':',  balance.toString());
    }
  });

  it('should have token it can send', async() => {
    const token = await CryptoErc20.deployed();
    assert(token);
  });

  it('should send tokens', async() => {
    const batcher = await SendToMany.deployed();
    const token = await CryptoErc20.deployed();
    const receivers = accounts.slice(1);
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const sum = (1e18*receivers.length).toString();
    const balanceBefore = await token.balanceOf(accounts[0]);
    console.log('Token balance before', balanceBefore.toString());
    await token.approve(batcher.address, sum);
    await batcher.sendMany(receivers, amounts, token.address);
    const balanceAfter = await token.balanceOf(accounts[0]);
    console.log('Token balance after', balanceAfter.toString());
    for(const receiver of receivers) {
      const balance = await token.balanceOf(receiver);
      console.log('Token Balance', receiver, ':',  balance.toString());
    }
  });

});
