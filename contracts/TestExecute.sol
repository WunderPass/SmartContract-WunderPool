// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

contract TestExecute {

  string public changeMe = "";
  
  function returnSenderAndValue() public payable returns(address, uint) {
    return (msg.sender, msg.value);
  }

  function addTwo(uint a, uint b) public pure returns(uint) {
    return a + b;
  }

  function updateString(string memory _newString) public {
    changeMe = _newString;
  }

  function shouldRevert() public pure {
    revert("Function reverted");
  }
}