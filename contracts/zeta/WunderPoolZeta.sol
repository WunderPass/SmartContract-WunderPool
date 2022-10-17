// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderVaultZeta.sol";

interface WunderProposal {
    function createProposal(
        address creator,
        uint256 proposalId,
        string memory title,
        string memory description,
        address[] memory contractAddresses,
        string[] memory actions,
        bytes[] memory params,
        uint256[] memory transactionValues
    ) external;

    function createJoinProposal(
        address user,
        uint256 proposalId,
        string memory title,
        string memory description,
        uint256 amount,
        uint256 governanceTokens,
        address paymentToken,
        address governanceToken,
        bytes memory signature
    ) external;

    function vote(
        uint256 proposalId,
        uint256 mode,
        address voter
    ) external;

    function proposalExecutable(address _pool, uint256 _proposalId)
        external
        view
        returns (bool executable, string memory errorMessage);

    function setProposalExecuted(uint256 _proposalId) external;

    function getProposalTransactions(address _pool, uint256 _proposalId)
        external
        view
        returns (
            string[] memory actions,
            bytes[] memory params,
            uint256[] memory transactionValues,
            address[] memory contractAddresses
        );
}

contract WunderPoolZeta is WunderVaultZeta {
    uint256[] internal proposalIds;

    mapping(bytes32 => uint256) public secretWhiteList;
    mapping(bytes32 => bool) internal _secretsUsed;

    mapping(address => bool) internal whiteList;
    address[] internal whitelistedUsers;
    mapping(address => uint256) public investOfUser;

    address[] internal members;
    mapping(address => bool) internal memberLookup;

    string public name;

    bool public poolClosed = false;

    modifier exceptPool() {
        require(msg.sender != address(this));
        _;
    }

    event NewProposal(
        uint256 indexed id,
        address indexed creator,
        string title
    );
    event Voted(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 mode
    );
    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed executor,
        bytes[] result
    );
    event NewMember(address indexed memberAddress, uint256 stake);

    constructor(
        string memory _name,
        address _launcher,
        address _governanceToken,
        address _creator,
        address[] memory _members,
        uint256 _amount
    ) WunderVaultZeta(_governanceToken) {
        name = _name;
        launcherAddress = _launcher;
        investOfUser[_creator] = _amount;
        members.push(_creator);
        memberLookup[_creator] = true;
        addToken(USDC, false, 0);
        for (uint256 i = 0; i < _members.length; i++) {
            whitelistedUsers.push(_members[i]);
            whiteList[_members[i]] = true;
        }
    }

    receive() external payable {}

    function createProposalForUser(
        address _user,
        string memory _title,
        string memory _description,
        address[] memory _contractAddresses,
        string[] memory _actions,
        bytes[] memory _params,
        uint256[] memory _transactionValues,
        bytes memory _signature
    ) public {
        uint256 nextProposalId = proposalIds.length;
        proposalIds.push(nextProposalId);

        bytes32 message = prefixed(
            keccak256(
                abi.encode(
                    _user,
                    address(this),
                    _title,
                    _description,
                    _contractAddresses,
                    _actions,
                    _params,
                    _transactionValues,
                    nextProposalId
                )
            )
        );

        reqSig(message, _signature, _user);
        reqMem(_user);

        ProposalModule().createProposal(
            _user,
            nextProposalId,
            _title,
            _description,
            _contractAddresses,
            _actions,
            _params,
            _transactionValues
        );

        emit NewProposal(nextProposalId, _user, _title);
    }

    function createJoinProposal(
        address _user,
        string memory _title,
        string memory _description,
        uint256 _amount,
        uint256 _governanceTokens,
        bytes memory _signature
    ) public {
        uint256 nextProposalId = proposalIds.length;
        proposalIds.push(nextProposalId);

        ProposalModule().createJoinProposal(
            _user,
            nextProposalId,
            _title,
            _description,
            _amount,
            _governanceTokens,
            USDC,
            governanceToken,
            _signature
        );

        emit NewProposal(nextProposalId, _user, _title);
    }

    function voteForUser(
        address _user,
        uint256 _proposalId,
        uint256 _mode,
        bytes memory _signature
    ) public {
        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(_user, address(this), _proposalId, _mode)
            )
        );

        reqSig(message, _signature, _user);
        ProposalModule().vote(_proposalId, _mode, _user);
        emit Voted(_proposalId, _user, _mode);
    }

    function executeProposal(uint256 _proposalId) public {
        poolClosed = true;
        (bool executable, string memory errorMessage) = ProposalModule()
            .proposalExecutable(address(this), _proposalId);
        require(executable, errorMessage);
        ProposalModule().setProposalExecuted(_proposalId);
        (
            string[] memory actions,
            bytes[] memory params,
            uint256[] memory transactionValues,
            address[] memory contractAddresses
        ) = ProposalModule().getProposalTransactions(
                address(this),
                _proposalId
            );
        bytes[] memory results = new bytes[](contractAddresses.length);

        for (uint256 index = 0; index < contractAddresses.length; index++) {
            address contractAddress = contractAddresses[index];
            bytes memory callData = bytes.concat(
                abi.encodeWithSignature(actions[index]),
                params[index]
            );

            bool success = false;
            bytes memory result;
            (success, result) = contractAddress.call{
                value: transactionValues[index]
            }(callData);
            require(success, string(result));
            results[index] = result;
        }

        emit ProposalExecuted(_proposalId, msg.sender, results);
    }

    function joinForUser(
        uint256 _amount,
        address _user,
        string memory _secret
    ) public exceptPool {
        if (governanceTokensOf(_user) <= 0) {
            require(!poolClosed, "Pool Closed");
            if (secretWhiteList[keccak256(bytes(_secret))] > 0) {
                secretWhiteList[keccak256(bytes(_secret))] -= 1;
            } else {
                require(isWhiteListed(_user), "Not On Whitelist");
            }

            reqJoin(_amount, _user);
            reqTra(USDC, _user, _amount);
            investOfUser[_user] += _amount;
            _issueGovernanceTokens(_user, _amount / governanceTokenPrice());
        }
        _addMember(_user);
        emit NewMember(_user, _amount);
    }

    function fundPool(uint256 _amount) external exceptPool {
        require(!poolClosed, "Pool Closed");
        require(
            investOfUser[msg.sender] + _amount <=
                ConfigModule().maxInvest(address(this)),
            "maxInvest reached"
        );
        investOfUser[msg.sender] += _amount;
        reqTra(USDC, msg.sender, _amount);
        _issueGovernanceTokens(msg.sender, _amount / governanceTokenPrice());
    }

    function addMember(address _newMember) public {
        require(msg.sender == address(this));
        _addMember(_newMember);
    }

    function _addMember(address _newMember) internal {
        require(!isMember(_newMember), "Already Member");
        members.push(_newMember);
        memberLookup[_newMember] = true;
        IPoolLauncher(launcherAddress).addPoolToMembersPools(
            address(this),
            _newMember
        );
    }

    function addToWhiteListForUser(
        address _user,
        address _newMember,
        bytes memory _signature
    ) public {
        reqMem(_user);
        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_user, address(this), _newMember))
        );

        reqSig(message, _signature, _user);

        if (!isWhiteListed(_newMember)) {
            whiteList[_newMember] = true;
            whitelistedUsers.push(_newMember);
            IPoolLauncher(launcherAddress).addPoolToMembersPools(
                address(this),
                _newMember
            );
        }
    }

    function addToWhiteListWithSecret(
        address _user,
        bytes32 _hashedSecret,
        uint256 _validForCount,
        bytes memory _signature
    ) public {
        reqMem(_user);
        require(!_secretsUsed[_hashedSecret]);
        bytes32 message = prefixed(
            keccak256(
                abi.encodePacked(
                    _user,
                    address(this),
                    _hashedSecret,
                    _validForCount
                )
            )
        );

        reqSig(message, _signature, _user);
        secretWhiteList[_hashedSecret] = _validForCount;
        _secretsUsed[_hashedSecret] = true;
    }

    function isMember(address _maybeMember) public view returns (bool) {
        return memberLookup[_maybeMember];
    }

    function isWhiteListed(address _user) public view returns (bool) {
        return whiteList[_user];
    }

    function poolMembers() public view returns (address[] memory) {
        return members;
    }

    function poolWhitelist() public view returns (address[] memory) {
        return whitelistedUsers;
    }

    function getAllProposalIds() public view returns (uint256[] memory) {
        return proposalIds;
    }

    function liquidatePool() public {
        require(msg.sender == address(this));
        _distributeFullBalanceOfAllTokensEvenly(members);
        _distributeAllMaticEvenly(members);
        _distributeAllNftsEvenly(members);
        _destroyGovernanceToken();
        selfdestruct(payable(members[0]));
    }

    //new by desp
    function leavePool() public {
        require(msg.sender == address(this));
        reqMem(msg.sender);
        //CHECK IF THERE IS A NFT, IF SO NOT POSSIBLE or IGNORE NFT
        address[] memory leaver; 
        leaver[0] = msg.sender;
        _distributeFullBalanceOfAllTokensEvenly(leaver);
        _distributeAllMaticEvenly(leaver);
        _distributeGovTokensOfLeaverToMembers(msg.sender, members);
        //removeMemberFromPool(member) Maybe not even needed if members implicit
    }

    function ProposalModule() internal view returns (WunderProposal) {
        return WunderProposal(IPoolLauncher(launcherAddress).wunderProposal());
    }

    function reqSig(
        bytes32 _msg,
        bytes memory _sig,
        address _usr
    ) internal pure {
        require(recoverSigner(_msg, _sig) == _usr, "Invalid Signature");
    }

    function reqMem(address _usr) internal view {
        require(isMember(_usr), "Not a Member");
    }

    function reqJoin(uint256 _amount, address _user) internal view {
        (bool canJoin, string memory errMsg) = ConfigModule().memberCanJoin(
            address(this),
            _amount,
            investOfUser[_user],
            governanceTokenPrice(),
            members.length
        );
        require(canJoin, errMsg);
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
