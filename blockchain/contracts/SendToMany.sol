pragma solidity ^0.4.23;
import "./IERC20.sol";

contract SendToMany {
  address owner;

  constructor() public {
    owner = msg.sender;
  }

  modifier isOwner() {
    require(msg.sender == owner, "must be the owner address");
    _;
  }

  function sendMany(address[] addresses, uint[] amounts, address tokenContract) public payable isOwner {
    require(addresses.length == amounts.length);
    uint sum = 0;
    for(uint i = 0; i < amounts.length; i++) {
      sum += amounts[i];
    }
    if(tokenContract != 0x0) {
      IERC20 token = IERC20(tokenContract);
      require(token.allowance(msg.sender, address(this)) >= sum, "This contract is not allowed enough funds for this batch");
      for(i = 0; i < addresses.length; i++) {
        require(token.transferFrom(msg.sender, addresses[i], amounts[i]), "token transfer failed");
      }
    } else {
      require((address(this).balance + msg.value) >= sum, "ETH balance too low for this batch");
      for(i = 0; i < addresses.length; i++) {
        addresses[i].transfer(amounts[i]);
      }
    }
  }


  function batchSend(address[] addresses, uint[] amounts, address[] tokenContracts) public payable {
    require(addresses.length == amounts.length, "must provide same length addresses and amounts");
    require(addresses.length == tokenContracts.length, "must provide same length addresses and tokenContracts");
    for(uint i = 0; i < addresses.length; i++) {
      address tokenContract = tokenContracts[i];
      address recipient = addresses[i];
      uint amount = amounts[i];
      if(tokenContract != 0x0) {
        IERC20 token = IERC20(tokenContract);
        require(token.transferFrom(msg.sender, recipient, amount), "token transfer failed");
      } else {
        require(msg.value + address(this).balance > amount, "must send enough ETH");
        recipient.transfer(amount);
      }
    }
  }
}
