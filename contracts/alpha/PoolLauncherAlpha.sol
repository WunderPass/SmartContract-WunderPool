// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderPoolAlpha.sol";

contract PoolLauncherAlpha {
  address[] public launchedPools;

  mapping (address => address[]) public creatorToPools;

  event PoolLaunched(address indexed creator, address indexed poolAddress, string name);

  function createNewPool(string memory _poolName) public {
    WunderPoolAlpha newPool = new WunderPoolAlpha(_poolName, msg.sender);
    launchedPools.push(address(newPool));
    creatorToPools[msg.sender].push(address(newPool));
    emit PoolLaunched(msg.sender, address(newPool), _poolName);
  }

  function poolsOfCreator(address _creator) public view returns(address[] memory) {
    return creatorToPools[_creator];
  }

  function allPools() public view returns(address[] memory) {
    return launchedPools;
  }
}