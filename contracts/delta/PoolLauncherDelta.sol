// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderPoolDelta.sol";
import "./PoolGovernanceTokenDelta.sol";

contract PoolLauncherDelta {
    address public USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
    address public wunderProposal;

    address[] public launchedPools;

    mapping(address => address[]) public memberPools;
    mapping(address => address[]) public whiteListedPools;

    event PoolLaunched(
        address indexed poolAddress,
        string name,
        address governanceTokenAddress,
        string governanceTokenName,
        uint256 entryBarrier
    );

    constructor(address _wunderProposal) {
        wunderProposal = _wunderProposal;
    }

    function createNewPool(
        string memory _poolName,
        uint256 _entryBarrier,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _tokenPrice,
        address _creator
    ) public {
        PoolGovernanceTokenDelta newToken = new PoolGovernanceTokenDelta(
            _tokenName,
            _tokenSymbol,
            _tokenPrice
        );
        WunderPoolDelta newPool = new WunderPoolDelta(
            _poolName,
            address(this),
            address(newToken),
            _entryBarrier,
            _creator
        );
        whiteListedPools[_creator].push(address(newPool));
        newToken.setPoolAddress(address(newPool));
        launchedPools.push(address(newPool));
        emit PoolLaunched(
            address(newPool),
            _poolName,
            address(newToken),
            _tokenName,
            _entryBarrier
        );
    }

    function poolsOfMember(address _member)
        public
        view
        returns (address[] memory)
    {
        return memberPools[_member];
    }

    function whiteListedPoolsOfMember(address _member)
        public
        view
        returns (address[] memory)
    {
        return whiteListedPools[_member];
    }

    function addPoolToMembersPools(address _pool, address _member) external {
        if (WunderPoolDelta(payable(_pool)).isMember(_member)) {
            memberPools[_member].push(_pool);
        } else if (WunderPoolDelta(payable(_pool)).isWhiteListed(_member)) {
            whiteListedPools[_member].push(_pool);
        }
    }

    function removePoolFromMembersPools(address _pool, address _member)
        external
    {
        address[] storage pools = memberPools[_member];
        for (uint256 index = 0; index < pools.length; index++) {
            if (pools[index] == _pool) {
                pools[index] = pools[pools.length - 1];
                delete pools[pools.length - 1];
                pools.pop();
            }
        }
    }

    function allPools() public view returns (address[] memory) {
        return launchedPools;
    }
}
