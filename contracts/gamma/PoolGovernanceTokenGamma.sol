// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract PoolGovernanceTokenGamma is ERC20 {
  address public launcherAddress;
  address public poolAddress;
  uint public price;

  constructor(string memory name, string memory symbol, address _creatorAddress, uint _amount) ERC20(name, symbol) {
    launcherAddress = msg.sender;
    _mint(_creatorAddress, 100);
    price = _amount / 100;
  }

  function decimals() public pure override returns(uint8) {
    return 0;
  }

  function setPoolAddress(address _poolAddress) external {
    require(msg.sender == launcherAddress);
    poolAddress = _poolAddress;
  }

  function issue(address _receiver, uint _amount) external {
    require(msg.sender == poolAddress || msg.sender == launcherAddress);
    _mint(_receiver, _amount);
  }

  function destroy() external {
    require(msg.sender == poolAddress);
    selfdestruct(payable(msg.sender));
  }
}