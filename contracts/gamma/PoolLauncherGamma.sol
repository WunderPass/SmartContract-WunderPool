// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderPoolGamma.sol";
import "./PoolGovernanceTokenGamma.sol";

contract PoolLauncherGamma {
  address public USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
  address[] public launchedPools;

  mapping (address => address[]) public memberPools;

  event PoolLaunched(address indexed creator, address indexed poolAddress, string name, address governanceTokenAddress, string governanceTokenName, uint entryBarrier);

  function createNewPool(string memory _poolName, uint _entryBarrier, string memory _tokenName, string memory _tokenSymbol, uint _invest) public {
    PoolGovernanceTokenGamma newToken = new PoolGovernanceTokenGamma(_tokenName, _tokenSymbol, msg.sender, _invest);
    WunderPoolGamma newPool = new WunderPoolGamma(_poolName, msg.sender, address(this), address(newToken), _entryBarrier);
    require(ERC20Interface(USDC).transferFrom(msg.sender, address(newPool), _invest), "USDC Transfer failed");
    newToken.setPoolAddress(address(newPool));
    launchedPools.push(address(newPool));
    memberPools[msg.sender].push(address(newPool));
    emit PoolLaunched(msg.sender, address(newPool), _poolName, address(newToken), _tokenName, _entryBarrier);
  }

  function poolsOfMember(address _member) public view returns(address[] memory) {
    return memberPools[_member];
  }

  function addPoolToMembersPools(address _pool, address _member) external {
    require(WunderPoolGamma(payable(_pool)).isMember(_member), "Not a Member");
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