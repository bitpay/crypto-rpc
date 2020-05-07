pragma solidity ^0.4.23;
import "./IERC20.sol";

contract SendToMany {

  address owner;
  mapping(address => uint) private tokenSums;

  constructor() public {
    owner = msg.sender;
  }

  modifier isOwner() {
    require(msg.sender == owner, "must be the owner address");
    _;
  }

  function sendMany(address[] memory addresses, uint[] memory amounts, address tokenContract) public payable isOwner {
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
      require((msg.value) >= sum, "must send enough ETH");
      for(i = 0; i < addresses.length; i++) {
        addresses[i].transfer(amounts[i]);
      }
    }
  }


  function validateBatch(address[] memory addresses, uint[] memory amounts, address[] memory tokenContracts, uint sentValue) public view returns(bool) {
    require(addresses.length == amounts.length, "must provide same length addresses and amounts");
    require(addresses.length == tokenContracts.length, "must provide same length addresses and tokenContracts");
    for(uint i = 0; i < addresses.length; i++) {
      address tokenContract = tokenContracts[i];
      uint amount = amounts[i];
      tokenSums[tokenContract] += amount;
      uint sum = tokenSums[tokenContract];
      if(tokenContract != 0x0) {
        IERC20 token = IERC20(tokenContract);
        require(token.allowance(msg.sender, address(this)) >= sum, "This contract is not allowed enough funds for this batch");
      } else {
        require(sentValue >= sum, "must send enough ETH");
      }
    }
    return true;
  }

  function batchSend(address[] memory addresses, uint[] memory amounts, address[] memory tokenContracts) public payable {
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
        require(msg.value >= amount, "must send enough ETH");
        recipient.transfer(amount);
      }
    }
  }
}
