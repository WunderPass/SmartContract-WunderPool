// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderPoolZeta.sol";

interface TokenLauncher {
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _amount,
        address _creator
    ) external returns (address);
}

contract PoolLauncherZeta {
    address public USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
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

    constructor(
        address _wunderProposal,
        address _poolConfig,
        address _governanceTokenLauncher
    ) {
        wunderProposal = _wunderProposal;
        poolConfig = _poolConfig;
        governanceTokenLauncher = _governanceTokenLauncher;
    }

    function createNewPool(
        string memory _poolName,
        string memory _tokenName,
        string memory _tokenSymbol,
        uint256 _amount,
        address _creator,
        address[] memory _members,
        uint256 _minInvest,
        uint256 _maxInvest,
        uint256 _maxMembers,
        uint8 _votingThreshold,
        uint256 _votingTime,
        uint256 _minYesVoters
    ) public {
        address newToken = TokenLauncher(governanceTokenLauncher).createToken(
            _tokenName,
            _tokenSymbol,
            _amount,
            _creator
        );
        address newPool = launchPool(
            newToken,
            _poolName,
            _amount,
            _creator,
            _members,
            _minInvest,
            _maxInvest,
            _maxMembers,
            _votingThreshold,
            _votingTime,
            _minYesVoters
        );

        for (uint256 i = 0; i < _members.length; i++) {
            whiteListedPools[_members[i]].push(newPool);
        }

        memberPools[_creator].push(newPool);
        IGovernanceToken(newToken).setPoolAddress(newPool);

        emit PoolLaunched(newPool, _poolName, newToken);
    }

    function launchPool(
        address newToken,
        string memory _poolName,
        uint256 _amount,
        address _creator,
        address[] memory _members,
        uint256 _minInvest,
        uint256 _maxInvest,
        uint256 _maxMembers,
        uint8 _votingThreshold,
        uint256 _votingTime,
        uint256 _minYesVoters
    ) internal returns (address) {
        require(_amount >= _minInvest && _amount <= _maxInvest);
        WunderPoolZeta newPool = new WunderPoolZeta(
            _poolName,
            address(this),
            address(newToken),
            _creator,
            _members,
            _amount
        );

        PoolConfig(poolConfig).setupPool(
            address(newPool),
            _minInvest,
            _maxInvest,
            _maxMembers,
            _votingThreshold,
            _votingTime,
            _minYesVoters
        );

        launchedPools.push(address(newPool));

        require(
            ERC20Interface(USDC).transferFrom(
                _creator,
                address(newPool),
                _amount
            ),
            "Transfer Failed"
        );

        newPool.transferFee(USDC, _amount);

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
        if (WunderPoolZeta(payable(_pool)).isMember(_member)) {
            memberPools[_member].push(_pool);
        } else if (WunderPoolZeta(payable(_pool)).isWhiteListed(_member)) {
            whiteListedPools[_member].push(_pool);
        }
    }

    function allPools() public view returns (address[] memory) {
        return launchedPools;
    }
}
