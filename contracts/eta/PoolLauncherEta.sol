// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderPoolEta.sol";

interface TokenLauncher {
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _amount,
        address _creator
    ) external returns (address);
}

contract PoolLauncherEta {
    address public USDC;
    address public wunderProposal;
    address public poolConfig;
    address public governanceTokenLauncher;

    address[] internal launchedPools;

    mapping(address => address[]) internal memberPools;
    mapping(address => address[]) internal whiteListedPools;

    event PoolLaunched(
        address indexed poolAddress,
        string name,
        address governanceTokenAddress
    );

    struct CreatePoolParams {
        string poolName;
        string tokenName;
        string tokenSymbol;
        uint256 amount;
        address creator;
        address[] members;
        uint256 minInvest;
        uint256 maxInvest;
        uint256 maxMembers;
        uint8 votingThreshold;
        uint256 votingTime;
        uint256 minYesVoters;
        bool isPublic;
        uint256 autoLiquidateTs;
    }

    constructor(
        address _wunderProposal,
        address _poolConfig,
        address _governanceTokenLauncher,
        address _usdc
    ) {
        wunderProposal = _wunderProposal;
        poolConfig = _poolConfig;
        governanceTokenLauncher = _governanceTokenLauncher;
        USDC = _usdc;
    }

    function createNewPool(CreatePoolParams memory params) public {
        address newToken = launchToken(params);
        address newPool = launchPool(newToken, params);

        for (uint256 i = 0; i < params.members.length; i++) {
            whiteListedPools[params.members[i]].push(newPool);
        }

        memberPools[params.creator].push(newPool);
        IGovernanceToken(newToken).setPoolAddress(newPool);

        emit PoolLaunched(newPool, params.poolName, newToken);
    }

    function launchToken(CreatePoolParams memory params)
        private
        returns (address)
    {
        return
            TokenLauncher(governanceTokenLauncher).createToken(
                params.tokenName,
                params.tokenSymbol,
                params.amount,
                params.creator
            );
    }

    function launchPool(address newToken, CreatePoolParams memory params)
        private
        returns (address)
    {
        require(
            params.amount >= params.minInvest &&
                params.amount <= params.maxInvest,
            "100: Invalid Join Amount"
        );
        WunderPoolEta newPool = new WunderPoolEta(
            params.poolName,
            address(this),
            newToken,
            params.creator,
            params.members,
            params.amount,
            params.isPublic,
            params.autoLiquidateTs,
            USDC
        );

        PoolConfig(poolConfig).setupPool(
            address(newPool),
            params.minInvest,
            params.maxInvest,
            params.maxMembers,
            params.votingThreshold,
            params.votingTime,
            params.minYesVoters
        );

        launchedPools.push(address(newPool));

        require(
            ERC20Interface(USDC).transferFrom(
                params.creator,
                address(newPool),
                params.amount
            ),
            "403: Transfer failed"
        );

        newPool.transferFee(USDC, params.amount);

        return address(newPool);
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
        if (WunderPoolEta(payable(_pool)).isMember(_member)) {
            memberPools[_member].push(_pool);
        } else if (WunderPoolEta(payable(_pool)).isWhiteListed(_member)) {
            whiteListedPools[_member].push(_pool);
        }
    }

    function removePoolFromMembersPools(address _pool, address _member)
        external
    {
        if (WunderPoolEta(payable(_pool)).isMember(_member)) return;
        for (uint256 i = 0; i < memberPools[_member].length; i++) {
            if (memberPools[_member][i] == _pool) {
                delete memberPools[_member][i];
                memberPools[_member][i] = memberPools[_member][
                    memberPools[_member].length - 1
                ];
                memberPools[_member].pop();
            }
        }
    }

    function allPools() public view returns (address[] memory) {
        return launchedPools;
    }
}
