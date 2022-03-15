const SendToMany = artifacts.require('SendToMany');
const CryptoErc20 = artifacts.require('CryptoErc20');
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const receivers = [
  '0x52bc44d5378309ee2abf1539bf71de1b7d7be3b5',
  '0x06b8c5883ec71bc3f4b332081519f23834c8706e',
  '0x5a0b54d5dc17e0aadc383d2db43b0a0d3e029c4c'
]
contract('SendToMany', (accounts) => {
  it('should exist', async() => {
    const batcher = await SendToMany.deployed();
    assert(batcher);
  });

  it('should send ether', async() => {
    const batcher = await SendToMany.deployed();
    const balances = await Promise.all(receivers.map( r => web3.eth.getBalance(r)));
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const balanceBefore = await web3.eth.getBalance(accounts[0]);
    const sum = (1e18*receivers.length).toString();
    await batcher.sendMany(receivers, amounts, ZERO_ADDR, {value: sum});
    const balanceAfter = await web3.eth.getBalance(accounts[0]);
    assert(balanceBefore > balanceAfter, "Account zero should have lower balance");
    for(let i = 0; i < receivers.length; i++) {
      const receiver = receivers[i];
      const balanceBefore = balances[i];
      const balance = await web3.eth.getBalance(receiver);
      assert(balance > balanceBefore, "Balance should increase");
    }
  });

  it('should have token it can send', async() => {
    const token = await CryptoErc20.deployed();
    assert(token);
  });

  it('should send tokens', async() => {
    const batcher = await SendToMany.deployed();
    const token = await CryptoErc20.deployed();
    const balances = await Promise.all(receivers.map( r => token.balanceOf(r)));
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const sum = (1e18*receivers.length).toString();
    await token.approve(batcher.address, sum);
    await batcher.sendMany(receivers, amounts, token.address);
    for(let i = 0; i < receivers.length; i++) {
      const receiver = receivers[i];
      const balanceBefore = balances[i];
      const balance = await token.balanceOf(receiver);
      assert(balance > balanceBefore, "Balance should increase");
    }
  });


  it('should send many different tokens', async() => {
    const batcher = await SendToMany.deployed();
    const token = await CryptoErc20.deployed();
    const balances = await Promise.all(receivers.map( r => token.balanceOf(r)));
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const sum = (1e18*receivers.length).toString();
    await token.approve(batcher.address, sum);
    const tokens = new Array(receivers.length).fill(token.address)

    //send one ETH
    tokens[0] = ZERO_ADDR;
    balances[0] = await web3.eth.getBalance(receivers[0]);


    await batcher.batchSend(receivers, amounts, tokens, {value: 1e18.toString()});
    for(let i = 0; i < receivers.length; i++) {
      const tokenAddress = tokens[i];
      const receiver = receivers[i];
      const balanceBefore = balances[i];
      const ethBalance = await web3.eth.getBalance(receiver);
      const tokenBalance = await token.balanceOf(receiver);
      if(tokenAddress != ZERO_ADDR) {
        assert(tokenBalance > balanceBefore, "Balance should increase");
      } else {
        assert(ethBalance > balanceBefore, "Balance should increase");
      }
    }
  });


  it('should validate a batch', async() => {
    const batcher = await SendToMany.deployed();
    const token = await CryptoErc20.deployed();
    const balances = await Promise.all(receivers.map( r => token.balanceOf(r)));
    const amounts = new Array(receivers.length).fill(1e18.toString());
    const sum = (1e18*receivers.length).toString();
    await token.approve(batcher.address, sum);
    const tokens = new Array(receivers.length).fill(token.address)

    //send one ETH
    tokens[0] = ZERO_ADDR;
    balances[0] = await web3.eth.getBalance(receivers[0]);

    const isValid = await batcher.validateBatch.call(receivers, amounts, tokens, 1e18.toString(), accounts[0]);
    assert(isValid, "Validate should return true");
    console.log("Validate returned true");

    try {
      const isNotValid = await batcher.validateBatch.call(receivers, amounts, tokens, 1e17.toString(), accounts[0]);
      assert(true == false, "Validate should have thrown");
    } catch(e) {
      console.log("Validate threw");
      assert(e, "Validate threw");
    }


    try {
      await token.approve(batcher.address, 0);
      const isNotValid = await batcher.validateBatch.call(receivers, amounts, tokens, 1e18.toString(), accounts[0]);
      assert(true == false, "Validate should have thrown");
    } catch(e) {
      console.log("Validate threw");
      assert(e, "Validate threw");
    }

    let threw = false;
    try {
      await token.approve(batcher.address, sum);
      await batcher.validateBatch(receivers, amounts, tokens, 1e18.toString(), accounts[0]);
      await batcher.validateBatch(receivers, amounts, tokens, 1e18.toString(), accounts[0]);
      await batcher.validateBatch.call(receivers, amounts, tokens, 1e18.toString(), accounts[0]);
    } catch(e) {
      threw = true;
      console.log(e);
      console.log("Validate (send) threw");
      assert(e, "Validate threw");
    }
    assert(threw === false, "validateBatch should not throw");
  });
});
