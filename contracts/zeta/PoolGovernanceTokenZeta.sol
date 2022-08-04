// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface PoolConfig {
    function treasury() external view returns (address);

    function feePerMille() external view returns (uint256);
}

interface IPoolLauncher {
    function poolConfig() external view returns (address);
}

contract PoolGovernanceTokenZeta is ERC20 {
    address public launcherAddress;
    address public poolAddress;
    uint256 public price;

    mapping(address => uint256) internal _votes;
    mapping(address => mapping(address => uint256)) internal _delegatedVotes;
    mapping(address => address) internal _delegated;
    mapping(address => uint256) public nonces;

    constructor(
        string memory name,
        string memory symbol,
        uint256 _amount,
        address _creator,
        address _launcher
    ) ERC20(name, symbol) {
        require(_amount >= 100, "Amount must be at least 100");
        launcherAddress = _launcher;
        price = _amount / 100;
        _votes[_creator] = 100;
        _mint(_creator, 100);
    }

    function decimals() public pure override returns (uint8) {
        return 0;
    }

    function setPoolAddress(address _poolAddress) external {
        require(msg.sender == launcherAddress);
        poolAddress = _poolAddress;
    }

    function issue(address _receiver, uint256 _amount) external {
        require(msg.sender == poolAddress);
        _votes[_receiver] += _amount;
        _mint(_receiver, _amount);
    }

    function swapTokenToGovTokens(
        address _user,
        address _token,
        uint256 _amount,
        uint256 _shares,
        bytes memory _signature
    ) external {
        require(msg.sender == poolAddress);
        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(
                    _user,
                    address(this),
                    _token,
                    _amount,
                    _shares,
                    nonces[_user]
                )
            )
        );
        require(
            recoverSigner(message, _signature) == _user,
            "Invalid Signature"
        );
        nonces[_user] += 1;

        PoolConfig config = PoolConfig(
            IPoolLauncher(launcherAddress).poolConfig()
        );

        uint256 fee = (_amount * config.feePerMille()) / 1000;
        uint256 residualAmount = _amount - fee;
        require(
            ERC20(_token).transferFrom(_user, config.treasury(), fee),
            "COULD NOT TRANSFER FEES"
        );

        require(
            ERC20(_token).transferFrom(
                _user,
                address(poolAddress),
                residualAmount
            ),
            "Transfer Failed"
        );

        _votes[_user] += _shares;
        _mint(_user, _shares);
    }

    function delegateVotes(address _to) external {
        _delegateVotes(msg.sender, _to);
    }

    function delegateForUser(
        address _user,
        address _to,
        bytes memory _signature
    ) external {
        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(_user, address(this), _to, nonces[_user])
            )
        );
        require(
            recoverSigner(message, _signature) == _user,
            "Invalid Signature"
        );
        nonces[_user] += 1;

        _delegateVotes(_user, _to);
    }

    function _delegateVotes(address _from, address _to) internal {
        uint256 votes = _votes[_from];
        _votes[_from] = 0;
        _votes[_to] += votes;
        _delegatedVotes[_from][_to] += votes;
        _delegated[_from] = _to;
    }

    function revokeVotes() external {
        _revokeVotes(msg.sender);
    }

    function revokeForUser(address _user, bytes memory _signature) external {
        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_user, address(this), nonces[_user]))
        );
        require(
            recoverSigner(message, _signature) == _user,
            "Invalid Signature"
        );
        nonces[_user] += 1;

        _revokeVotes(_user);
    }

    function _revokeVotes(address _user) internal {
        address delegator = _delegated[_user];
        uint256 votes = _delegatedVotes[_user][delegator];
        _votes[_user] += votes;
        _votes[delegator] -= votes;
        _delegatedVotes[_user][delegator] -= votes;
        _delegated[_user] = address(0);
    }

    function votesOf(address _holder) public view returns (uint256) {
        return _votes[_holder];
    }

    function hasDelegated(address _holder)
        public
        view
        returns (address, uint256)
    {
        address delegator = _delegated[_holder];
        return (delegator, _delegatedVotes[_holder][delegator]);
    }

    function destroy() external {
        require(msg.sender == poolAddress);
        selfdestruct(payable(msg.sender));
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        require(sig.length == 65);

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }
}
