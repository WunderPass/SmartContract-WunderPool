// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./WunderVaultGamma.sol";

interface IPoolLauncherGamma {
  function addPoolToMembersPools(address _pool, address _member) external;
  function removePoolFromMembersPools(address _pool, address _member) external;
}

contract WunderPoolGamma is WunderVaultGamma {
  enum VoteType { None, For, Against }

  struct Proposal {
    string title;
    string description;
    address[] contractAddresses;
    string[] actions;
    bytes[] params;
    uint[] transactionValues;
    uint deadline;
    address[] yesVoters;
    address[] noVoters;
    uint createdAt;
    bool executed;
    mapping(address => VoteType) hasVoted;
  }

  mapping (uint => Proposal) public proposals;
  uint[] public proposalIds;

  address[] public members;
  mapping (address => bool) public memberLookup;
  
  string public name;
  address public launcherAddress;
  uint public entryBarrier;

  modifier onlyMember {
    require(isMember(msg.sender), "Not a Member");
    _;
  }

  event NewProposal(uint indexed id, address indexed creator, string title);
  event Voted(uint indexed proposalId, address indexed voter, uint mode);
  event ProposalExecuted(uint indexed proposalId, address indexed executor, bytes[] result);
  event NewMember(address indexed memberAddress, uint stake);

  constructor (string memory _name, address _creator, address _launcher, address _governanceToken, uint _entryBarrier) WunderVaultGamma(_governanceToken) {
    name = _name;
    launcherAddress = _launcher;
    entryBarrier = _entryBarrier;
    members.push(_creator);
    memberLookup[_creator] = true;
    addToken(USDC, false, 0);
  }

  receive() external payable {}

  function createProposal(string memory _title, string memory _description, address _contractAddress, string memory _action, bytes memory _param, uint _transactionValue, uint _deadline) public onlyMember {
    address[] memory _contractAddresses = new address[](1);
    _contractAddresses[0] = _contractAddress;
    string[] memory _actions = new string[](1);
    _actions[0] = _action;
    bytes[] memory _params = new bytes[](1);
    _params[0] = _param;
    uint[] memory _transactionValues = new uint[](1);
    _transactionValues[0] = _transactionValue;
    
    createMultiActionProposal(_title, _description, _contractAddresses, _actions, _params, _transactionValues, _deadline);
  }

  function createMultiActionProposal(string memory _title, string memory _description, address[] memory _contractAddresses, string[] memory _actions, bytes[] memory _params, uint[] memory _transactionValues, uint _deadline) public onlyMember {
    require(_contractAddresses.length == _actions.length && _actions.length == _params.length && _params.length == _transactionValues.length, "Inconsistent amount of transactions");
    require(bytes(_title).length > 0, "Missing Title");
    require(_deadline > block.timestamp, "Invalid Deadline");

    for (uint256 index = 0; index < _contractAddresses.length; index++) {
      require(_contractAddresses[index] != address(0), "Missing Address");
      require(bytes(_actions[index]).length > 0, "Missing Action");
    }
    
    uint nextProposalId = proposalIds.length;
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

  function hasVoted(uint proposalId, address account) public view returns (VoteType) {
    return proposals[proposalId].hasVoted[account];
  }

  function vote(uint _proposalId, uint _mode) public onlyMember {
    Proposal storage proposal = proposals[_proposalId];
    require(proposal.actions.length > 0, "Does not exist");
    require(block.timestamp <= proposal.deadline, "Voting period has ended");
    require(hasVoted(_proposalId, msg.sender) == VoteType.None, "Already voted");

    if (_mode == uint8(VoteType.Against)) {
      proposal.hasVoted[msg.sender] = VoteType.Against;
      proposal.noVoters.push(msg.sender);
    } else if (_mode == uint8(VoteType.For)) {
      proposal.hasVoted[msg.sender] = VoteType.For;
      proposal.yesVoters.push(msg.sender);
    } else {
      revert("Invalid VoteType (1=YES, 2=NO)");
    }
    emit Voted(_proposalId, msg.sender, _mode);
  }

  function calculateVotes(uint _proposalId) public view returns(uint yesVotes, uint noVotes) {
    Proposal storage proposal = proposals[_proposalId];
    uint yes;
    uint no;
    for (uint256 i = 0; i < proposal.noVoters.length; i++) {
      no += governanceTokensOf(proposal.noVoters[i]);
    }
    for (uint256 i = 0; i < proposal.yesVoters.length; i++) {
      yes += governanceTokensOf(proposal.yesVoters[i]);
    }
    return(yes, no);
  }

  function executeProposal(uint _proposalId) public {
    Proposal storage proposal = proposals[_proposalId];
    require(proposal.actions.length > 0, "Does not exist");
    require(!proposal.executed, "Already executed");
    (uint yesVotes, uint noVotes) = calculateVotes(_proposalId);
    require((noVotes * 2) <= totalGovernanceTokens(), "Majority voted against execution");
    require((yesVotes * 2) > totalGovernanceTokens() || proposal.deadline <= block.timestamp, "Voting still allowed");

    uint transactionTotal = 0;
    for (uint256 index = 0; index < proposal.transactionValues.length; index++) {
      transactionTotal += proposal.transactionValues[index];
    }

    require(transactionTotal <= address(this).balance, "Not enough funds");
    
    proposal.executed = true;
    
    bytes[] memory results = new bytes[](proposal.contractAddresses.length);

    for (uint256 index = 0; index < proposal.contractAddresses.length; index++) {
      address contractAddress = proposal.contractAddresses[index];
      bytes memory callData = bytes.concat(abi.encodeWithSignature(proposal.actions[index]), proposal.params[index]);

      bool success = false;
      bytes memory result;
      (success, result) = contractAddress.call{value: proposal.transactionValues[index]}(callData);
      require(success, "Execution failed");
      results[index] = result;
    }
    
    emit ProposalExecuted(_proposalId, msg.sender, results);
  }

  function joinPool(uint amount) public {
    require((amount >= entryBarrier && amount >= governanceTokenPrice()) || governanceTokensOf(msg.sender) > 0, "Your stake is not high enough");
    require(ERC20Interface(USDC).transferFrom(msg.sender, address(this), amount), "USDC Transfer failed");
    addMember(msg.sender);
    _issueGovernanceTokens(msg.sender, amount);
    emit NewMember(msg.sender, amount);
  }

  function fundPool(uint amount) external {
    require(ERC20Interface(USDC).transferFrom(msg.sender, address(this), amount), "USDC Transfer failed");
    _issueGovernanceTokens(msg.sender, amount);
  }

  function addMember(address _newMember) internal {
    require(!isMember(_newMember), "Already Member");
    members.push(_newMember);
    memberLookup[_newMember] = true;
    IPoolLauncherGamma(launcherAddress).addPoolToMembersPools(address(this), _newMember);
  }

  function isMember(address _maybeMember) public view returns (bool) {
    return memberLookup[_maybeMember];
  }

  function poolMembers() public view returns(address[] memory) {
    return members;
  }

  function getAllProposalIds() public view returns(uint[] memory) {
    return proposalIds;
  }

  function getProposal(uint _proposalId) public view returns(string memory title, string memory description, uint transactionCount, uint deadline, uint yesVotes, uint noVotes, uint totalVotes, uint createdAt, bool executed) {
    Proposal storage proposal = proposals[_proposalId];
    (uint yes, uint no) = calculateVotes(_proposalId);
    return (proposal.title, proposal.description, proposal.actions.length, proposal.deadline, yes, no, totalGovernanceTokens(), proposal.createdAt, proposal.executed);
  }

  function getProposalTransaction(uint _proposalId, uint _transactionIndex) public view returns(string memory action, bytes memory param, uint transactionValue, address contractAddress) {
    Proposal storage proposal = proposals[_proposalId];
    return (proposal.actions[_transactionIndex], proposal.params[_transactionIndex], proposal.transactionValues[_transactionIndex], proposal.contractAddresses[_transactionIndex]);
  }
  
  function liquidatePool() public onlyPool {
    _distributeFullBalanceOfAllTokensEvenly(members);
    _distributeAllMaticEvenly(members);
    _distributeAllNftsEvenly(members);
    _destroyGovernanceToken();
    selfdestruct(payable(msg.sender));
  }
}