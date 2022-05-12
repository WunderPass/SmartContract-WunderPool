// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderVaultDelta.sol";

interface IPoolLauncherDelta {
    function addPoolToMembersPools(address _pool, address _member) external;

    function removePoolFromMembersPools(address _pool, address _member)
        external;
}

contract WunderPoolDelta is WunderVaultDelta {
    enum VoteType {
        None,
        For,
        Against
    }

    struct Proposal {
        string title;
        string description;
        address[] contractAddresses;
        string[] actions;
        bytes[] params;
        uint256[] transactionValues;
        uint256 deadline;
        address[] yesVoters;
        address[] noVoters;
        uint256 createdAt;
        bool executed;
        mapping(address => VoteType) hasVoted;
    }

    mapping(uint256 => Proposal) public proposals;
    uint256[] public proposalIds;

    address[] public whiteList;
    mapping(address => bool) public whiteListLookup;

    address[] public members;
    mapping(address => bool) public memberLookup;

    string public name;
    address public launcherAddress;
    uint256 public entryBarrier;

    bool public poolClosed = false;

    modifier onlyMember() {
        require(isMember(msg.sender), "Not a Member");
        _;
    }

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
        uint256 _entryBarrier,
        address creator
    ) WunderVaultDelta(_governanceToken) {
        name = _name;
        launcherAddress = _launcher;
        entryBarrier = _entryBarrier;
        addToWhiteList(creator);
        addToken(USDC, false, 0);
    }

    receive() external payable {}

    function createProposal(
        string memory _title,
        string memory _description,
        address _contractAddress,
        string memory _action,
        bytes memory _param,
        uint256 _transactionValue,
        uint256 _deadline
    ) public onlyMember {
        address[] memory _contractAddresses = new address[](1);
        _contractAddresses[0] = _contractAddress;
        string[] memory _actions = new string[](1);
        _actions[0] = _action;
        bytes[] memory _params = new bytes[](1);
        _params[0] = _param;
        uint256[] memory _transactionValues = new uint256[](1);
        _transactionValues[0] = _transactionValue;

        createMultiActionProposal(
            _title,
            _description,
            _contractAddresses,
            _actions,
            _params,
            _transactionValues,
            _deadline
        );
    }

    function createMultiActionProposal(
        string memory _title,
        string memory _description,
        address[] memory _contractAddresses,
        string[] memory _actions,
        bytes[] memory _params,
        uint256[] memory _transactionValues,
        uint256 _deadline
    ) public onlyMember {
        require(
            _contractAddresses.length == _actions.length &&
                _actions.length == _params.length &&
                _params.length == _transactionValues.length,
            "Inconsistent amount of transactions"
        );
        require(bytes(_title).length > 0, "Missing Title");
        require(_deadline > block.timestamp, "Invalid Deadline");

        for (uint256 index = 0; index < _contractAddresses.length; index++) {
            require(_contractAddresses[index] != address(0), "Missing Address");
            require(bytes(_actions[index]).length > 0, "Missing Action");
        }

        uint256 nextProposalId = proposalIds.length;
        proposalIds.push(nextProposalId);

        Proposal storage newProposal = proposals[nextProposalId];
        newProposal.title = _title;
        newProposal.description = _description;
        newProposal.actions = _actions;
        newProposal.params = _params;
        newProposal.transactionValues = _transactionValues;
        newProposal.contractAddresses = _contractAddresses;
        newProposal.deadline = _deadline;
        newProposal.createdAt = block.timestamp;
        newProposal.executed = false;

        emit NewProposal(nextProposalId, msg.sender, _title);
    }

    function hasVoted(uint256 proposalId, address account)
        public
        view
        returns (VoteType)
    {
        return proposals[proposalId].hasVoted[account];
    }

    // prefix is most likely "\x19Ethereum Signed Message:\n32"
    function voteForUser(
        uint256 _proposalId,
        uint256 _mode,
        bytes32 msgHash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public {
        address user = ecrecover(msgHash, v, r, s);
        _vote(_proposalId, _mode, user);
    }

    function vote(uint256 _proposalId, uint256 _mode) public {
        _vote(_proposalId, _mode, msg.sender);
    }

    function _vote(
        uint256 _proposalId,
        uint256 _mode,
        address _voter
    ) internal {
        require(isMember(_voter));
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.actions.length > 0, "Does not exist");
        require(
            block.timestamp <= proposal.deadline,
            "Voting period has ended"
        );
        require(
            hasVoted(_proposalId, _voter) == VoteType.None,
            "Already voted"
        );

        if (_mode == uint8(VoteType.Against)) {
            proposal.hasVoted[_voter] = VoteType.Against;
            proposal.noVoters.push(_voter);
        } else if (_mode == uint8(VoteType.For)) {
            proposal.hasVoted[_voter] = VoteType.For;
            proposal.yesVoters.push(_voter);
        } else {
            revert("Invalid VoteType (1=YES, 2=NO)");
        }
        emit Voted(_proposalId, _voter, _mode);
    }

    function calculateVotes(uint256 _proposalId)
        public
        view
        returns (uint256 yesVotes, uint256 noVotes)
    {
        Proposal storage proposal = proposals[_proposalId];
        uint256 yes;
        uint256 no;
        for (uint256 i = 0; i < proposal.noVoters.length; i++) {
            no += governanceTokensOf(proposal.noVoters[i]);
        }
        for (uint256 i = 0; i < proposal.yesVoters.length; i++) {
            yes += governanceTokensOf(proposal.yesVoters[i]);
        }
        return (yes, no);
    }

    function executeProposal(uint256 _proposalId) public {
        poolClosed = true;
        Proposal storage proposal = proposals[_proposalId];
        require(proposal.actions.length > 0, "Does not exist");
        require(!proposal.executed, "Already executed");
        (uint256 yesVotes, uint256 noVotes) = calculateVotes(_proposalId);
        require(
            (noVotes * 2) <= totalGovernanceTokens(),
            "Majority voted against execution"
        );
        require(
            (yesVotes * 2) > totalGovernanceTokens() ||
                proposal.deadline <= block.timestamp,
            "Voting still allowed"
        );

        uint256 transactionTotal = 0;
        for (
            uint256 index = 0;
            index < proposal.transactionValues.length;
            index++
        ) {
            transactionTotal += proposal.transactionValues[index];
        }

        require(transactionTotal <= address(this).balance, "Not enough funds");

        proposal.executed = true;

        bytes[] memory results = new bytes[](proposal.contractAddresses.length);

        for (
            uint256 index = 0;
            index < proposal.contractAddresses.length;
            index++
        ) {
            address contractAddress = proposal.contractAddresses[index];
            bytes memory callData = bytes.concat(
                abi.encodeWithSignature(proposal.actions[index]),
                proposal.params[index]
            );

            bool success = false;
            bytes memory result;
            (success, result) = contractAddress.call{
                value: proposal.transactionValues[index]
            }(callData);
            require(success, "Execution failed");
            results[index] = result;
        }

        emit ProposalExecuted(_proposalId, msg.sender, results);
    }

    function joinPool(uint256 amount) public {
        require(!poolClosed);
        require(
            (amount >= entryBarrier && amount >= governanceTokenPrice()),
            "Increase Stake"
        );
        require(
            ERC20Interface(USDC).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "USDC Transfer failed"
        );
        addMember(msg.sender);
        _issueGovernanceTokens(msg.sender, amount);
        emit NewMember(msg.sender, amount);
    }

    function joinForUser(uint256 amount, address user) public exceptPool {
        require(!poolClosed);
        require(
            (amount >= entryBarrier && amount >= governanceTokenPrice()),
            "Increase Stake"
        );
        require(
            ERC20Interface(USDC).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "USDC Transfer failed"
        );
        addMember(user);
        _issueGovernanceTokens(user, amount);
        emit NewMember(user, amount);
    }

    function fundPool(uint256 amount) external exceptPool {
        require(!poolClosed);
        require(
            ERC20Interface(USDC).transferFrom(
                msg.sender,
                address(this),
                amount
            ),
            "USDC Transfer failed"
        );
        _issueGovernanceTokens(msg.sender, amount);
    }

    function addMember(address _newMember) internal {
        require(!isMember(_newMember), "Already Member");
        require(isWhiteListed(_newMember), "Not On Whitelist");
        members.push(_newMember);
        memberLookup[_newMember] = true;
        IPoolLauncherDelta(launcherAddress).addPoolToMembersPools(
            address(this),
            _newMember
        );
    }

    function addToWhiteList(address _newMember) public onlyMember {
        if (!isWhiteListed(_newMember)) {
            whiteList.push(_newMember);
            whiteListLookup[_newMember] = true;
            IPoolLauncherDelta(launcherAddress).addPoolToMembersPools(
                address(this),
                _newMember
            );
        }
    }

    function isMember(address _maybeMember) public view returns (bool) {
        return memberLookup[_maybeMember];
    }

    function isWhiteListed(address _user) public view returns (bool) {
        return whiteListLookup[_user];
    }

    function poolMembers() public view returns (address[] memory) {
        return members;
    }

    function getAllProposalIds() public view returns (uint256[] memory) {
        return proposalIds;
    }

    function getProposal(uint256 _proposalId)
        public
        view
        returns (
            string memory title,
            string memory description,
            uint256 transactionCount,
            uint256 deadline,
            uint256 yesVotes,
            uint256 noVotes,
            uint256 totalVotes,
            uint256 createdAt,
            bool executed
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        (uint256 yes, uint256 no) = calculateVotes(_proposalId);
        return (
            proposal.title,
            proposal.description,
            proposal.actions.length,
            proposal.deadline,
            yes,
            no,
            totalGovernanceTokens(),
            proposal.createdAt,
            proposal.executed
        );
    }

    function getProposalTransaction(
        uint256 _proposalId,
        uint256 _transactionIndex
    )
        public
        view
        returns (
            string memory action,
            bytes memory param,
            uint256 transactionValue,
            address contractAddress
        )
    {
        Proposal storage proposal = proposals[_proposalId];
        return (
            proposal.actions[_transactionIndex],
            proposal.params[_transactionIndex],
            proposal.transactionValues[_transactionIndex],
            proposal.contractAddresses[_transactionIndex]
        );
    }

    function liquidatePool() public onlyPool {
        _distributeFullBalanceOfAllTokensEvenly(members);
        _distributeAllMaticEvenly(members);
        _distributeAllNftsEvenly(members);
        _destroyGovernanceToken();
        selfdestruct(payable(msg.sender));
    }
}
