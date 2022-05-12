// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderPoolBeta.sol";
import "./PoolGovernanceTokenBeta.sol";

interface IWunderPoolBeta {
  function isMember(address _member) external view returns(bool);
}

contract PoolLauncherBeta {
  address[] public launchedPools;

  mapping (address => address[]) public memberPools;

  event PoolLaunched(address indexed creator, address indexed poolAddress, string name, string governanceTokenName);

  function createNewPool(string memory _poolName, uint _entryBarrier, string memory _tokenName, string memory _tokenSymbol) public payable {
    PoolGovernanceTokenBeta newToken = new PoolGovernanceTokenBeta(_tokenName, _tokenSymbol, msg.sender, msg.value);
    WunderPoolBeta newPool = new WunderPoolBeta{value: msg.value}(_poolName, msg.sender, address(this), address(newToken), _entryBarrier);
    newToken.setPoolAddress(address(newPool));
    launchedPools.push(address(newPool));
    memberPools[msg.sender].push(address(newPool));
    emit PoolLaunched(msg.sender, address(newPool), _poolName, _tokenName);
  }

  function poolsOfMember(address _member) public view returns(address[] memory) {
    return memberPools[_member];
  }

  function addPoolToMembersPools(address _pool, address _member) external {
    require(IWunderPoolBeta(_pool).isMember(_member), "User is not Member of the Pool");
    memberPools[_member].push(_pool);
  }

  function removePoolFromMembersPools(address _pool, address _member) external {
    address[] storage pools = memberPools[_member];
    for (uint256 index = 0; index < pools.length; index++) {
      if (pools[index] == _pool) {
        pools[index] = pools[pools.length - 1];
        delete pools[pools.length - 1];
        pools.pop();
      }
    }
  }

  function allPools() public view returns(address[] memory) {
    return launchedPools;
  }
}