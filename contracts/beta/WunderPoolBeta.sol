// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./WunderVaultBeta.sol";

interface IPoolLauncherBeta {
  function addPoolToMembersPools(address _pool, address _member) external;
  function removePoolFromMembersPools(address _pool, address _member) external;
}

contract WunderPoolBeta is AccessControl, WunderVaultBeta {
  bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");

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

  enum VoteType {
    None,
    For,
    Against
  }

  mapping (uint => Proposal) public proposals;
  uint[] public proposalIds;
  uint[] public openProposalIds;

  address[] public members;
  string public name;
  address public launcherAddress;
  uint public entryBarrier;

  event NewProposal(uint indexed id, address indexed creator, string title);
  event Voted(uint indexed proposalId, address indexed voter, uint mode);
  event ProposalExecuted(uint indexed proposalId, address indexed executor, bytes[] result);

  constructor (string memory _name, address _creator, address _launcher, address _governanceToken, uint _entryBarrier) payable WunderVaultBeta(_governanceToken) {
    name = _name;
    launcherAddress = _launcher;
    entryBarrier = _entryBarrier;
    members.push(_creator);
    _grantRole(MEMBER_ROLE, _creator);
  }

  receive() external payable {
    _issueGovernanceTokens(msg.sender, msg.value);
  }

  function createProposal(string memory _title, string memory _description, address _contractAddress, string memory _action, bytes memory _param, uint _transactionValue, uint _deadline) public onlyRole(MEMBER_ROLE) {
    address[] memory _contractAddresses = new address[](1);
    _contractAddresses[0] = _contractAddress;
    string[] memory _actions = new string[](1);
    _actions[0] = _action;
    bytes[] memory _params = new bytes[](1);
    _params[0] = _param;
    uint[] memory _transactionValues = new uint[](1);
    _transactionValues[0] = _transactionValue;
    
    _createProposal(_title, _description, _contractAddresses, _actions, _params, _transactionValues, _deadline);
  }

  function createMultiActionProposal(string memory _title, string memory _description, address[] memory _contractAddresses, string[] memory _actions, bytes[] memory _params, uint[] memory _transactionValues, uint _deadline) public onlyRole(MEMBER_ROLE) {
    _createProposal(_title, _description, _contractAddresses, _actions, _params, _transactionValues, _deadline);
  }

  function _createProposal(string memory _title, string memory _description, address[] memory _contractAddresses, string[] memory _actions, bytes[] memory _params, uint[] memory _transactionValues, uint _deadline) internal {
    require(_contractAddresses.length == _actions.length && _actions.length == _params.length && _params.length == _transactionValues.length, "Invalid Proposal: Inconsistens amount of transactions");
    require(bytes(_title).length > 0, "Invalid Proposal: Missing Parameter Title");
    require(_deadline > block.timestamp, "Invalid Proposal: Deadline needs to be in the Future");

    for (uint256 index = 0; index < _contractAddresses.length; index++) {
      require(_contractAddresses[index] != address(0), "Invalid Proposal: Missing Parameter Contract Address");
      require(bytes(_actions[index]).length > 0, "Invalid Proposal: Missing Parameter Action");
    }
    
    uint nextProposalId = proposalIds.length;
    proposalIds.push(nextProposalId);
    openProposalIds.push(nextProposalId);

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

  function hasVoted(uint256 proposalId, address account) public view returns (VoteType) {
    return proposals[proposalId].hasVoted[account];
  }

  function vote(uint proposalId, uint mode) public onlyRole(MEMBER_ROLE) {
    Proposal storage proposal = proposals[proposalId];
    require(proposal.actions.length > 0, "Voting not permitted: Proposal does not exist");
    require(block.timestamp <= proposal.deadline, "Voting not permitted: Voting period has ended");
    require(hasVoted(proposalId, msg.sender) == VoteType.None, "Voting not permitted: Voter has already voted");

    if (mode == uint8(VoteType.Against)) {
      proposal.hasVoted[msg.sender] = VoteType.Against;
      proposal.noVoters.push(msg.sender);
    } else if (mode == uint8(VoteType.For)) {
      proposal.hasVoted[msg.sender] = VoteType.For;
      proposal.yesVoters.push(msg.sender);
    } else {
      revert("Voting not permitted: Invalid value for VoteType (1 = YES, 2 = NO)");
    }

    emit Voted(proposalId, msg.sender, mode);
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
    require(proposal.actions.length > 0, "Execution not permitted: Proposal does not exist");
    require(!proposal.executed, "Execution not permitted: Proposal already executed");
    (uint yesVotes, uint noVotes) = calculateVotes(_proposalId);
    require((noVotes * 2) <= totalGovernanceTokens(), "Execution not permitted: Majority voted against execution");
    require((yesVotes * 2) > totalGovernanceTokens() || proposal.deadline <= block.timestamp, "Execution not permitted: Voting is still allowed");

    uint transactionTotal = 0;
    for (uint256 index = 0; index < proposal.transactionValues.length; index++) {
      transactionTotal += proposal.transactionValues[index];
    }

    require(transactionTotal <= address(this).balance, "Execution not permitted: Pool does not have enough funds");
    
    proposal.executed = true;
    for (uint256 index = 0; index < openProposalIds.length; index++) {
      if (openProposalIds[index] == _proposalId) {
        openProposalIds[index] = openProposalIds[openProposalIds.length - 1];
        delete openProposalIds[openProposalIds.length - 1];
        openProposalIds.pop();
      }
    }
    
    bytes[] memory results = new bytes[](proposal.contractAddresses.length);

    for (uint256 index = 0; index < proposal.contractAddresses.length; index++) {
      address contractAddress = proposal.contractAddresses[index];
      bytes memory callData = bytes.concat(abi.encodeWithSignature(proposal.actions[index]), proposal.params[index]);

      bool success = false;
      bytes memory result;
      if (proposal.transactionValues[index] > 0) {
        (success, result) = contractAddress.call{value: proposal.transactionValues[index]}(callData);
      } else {
        (success, result) = contractAddress.call(callData);
      }
      require(success, "Execution failed");
      results[index] = result;
    }
    
    emit ProposalExecuted(_proposalId, msg.sender, results);
  }

  function enterPool() public payable {
    require(msg.value >= entryBarrier && msg.value >= governanceTokenPrice(), "Your stake is not high enough");
    addMember(msg.sender);
    _issueGovernanceTokens(msg.sender, msg.value);
  }

  function addMember(address _newMember) internal {
    require(!isMember(_newMember), "Is already a Member");
    members.push(_newMember);
    _grantRole(MEMBER_ROLE, _newMember);
    IPoolLauncherBeta(launcherAddress).addPoolToMembersPools(address(this), _newMember);
  }

  function isMember(address _member) public view returns (bool) {
    return hasRole(MEMBER_ROLE, _member);
  }

  function poolMembers() public view returns(address[] memory) {
    return members;
  }

  function getAllProposalIds() public view returns(uint[] memory) {
    return proposalIds;
  }

  function getAllOpenProposalIds() public view returns(uint[] memory) {
    return openProposalIds;
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
    _destroyGovernanceToken();
    selfdestruct(payable(msg.sender));
  }
}