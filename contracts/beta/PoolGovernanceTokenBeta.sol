// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PoolGovernanceTokenBeta is ERC20 {
  address public launcherAddress;
  address public poolAddress;
  uint public price;

  constructor(string memory name, string memory symbol, address _creatorAddress, uint _amount) ERC20(name, symbol) {
    _mint(_creatorAddress, 100);
    price = _amount / 100;
    launcherAddress = msg.sender;
  }

  function decimals() public pure override returns(uint8) {
    return 0;
  }

  function setPoolAddress(address _poolAddress) external {
    require(msg.sender == launcherAddress, "Only the Launcher can set the PoolAddress");
    poolAddress = _poolAddress;
  }

  function issue(address _receiver, uint _amount) external {
    require(msg.sender == poolAddress, "Only the Pool can issue new tokens");
    _mint(_receiver, _amount);
  }

  function destroy() external {
    require(msg.sender == poolAddress, "Only the Pool can destroy this contract");
    selfdestruct(payable(msg.sender));
  }
}