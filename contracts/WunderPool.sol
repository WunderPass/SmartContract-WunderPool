// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./WunderVault.sol";

contract WunderPool is AccessControl, WunderVault {
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
  bytes32 public constant MEMBER_ROLE = keccak256("MEMBER_ROLE");

  struct Proposal {
    string title;
    string description;
    address[] contractAddresses;
    string[] actions;
    bytes[] params;
    uint[] transactionValues;
    uint deadline;
    uint yesVotes;
    uint noVotes;
    uint abstainVotes;
    uint createdAt;
    bool executed;
    mapping(address => bool) hasVoted;
  }

  enum VoteType {
    For,
    Against,
    Abstain
  }

  mapping (uint => Proposal) public proposals;
  uint[] public proposalIds;
  uint[] public openProposalIds;

  address[] public members;
  string public poolName;

  event NewProposal(uint indexed id, address indexed creator, string title);
  event Voted(uint indexed proposalId, address indexed voter, uint mode);
  event ProposalExecuted(uint indexed proposalId, address indexed executor, bytes[] result);

  constructor (string memory _poolName, address _creator) {
    poolName = _poolName;
    _grantRole(ADMIN_ROLE, _creator);
    _grantRole(MEMBER_ROLE, _creator);
    members.push(_creator);
  }

  receive() external payable {}

  function createProposal(string memory _title, string memory _description, address _contractAddress, string memory _action, bytes memory _param, uint _transactionValue, uint _deadline) public onlyRole(MEMBER_ROLE) {
    require(bytes(_title).length > 0, "Invalid Proposal: Missing Parameter Title");
    require(_contractAddress != address(0), "Invalid Proposal: Missing Parameter Contract Address");
    require(bytes(_action).length > 0, "Invalid Proposal: Missing Parameter Action");
    require(_deadline > 0, "Invalid Proposal: Missing Parameter Deadline");
    require(_deadline > block.timestamp, "Invalid Proposal: Deadline needs to be in the Future");
    
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
    require(_deadline > 0, "Invalid Proposal: Missing Parameter Deadline");
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

  function hasVoted(uint256 proposalId, address account) public view returns (bool) {
    return proposals[proposalId].hasVoted[account];
  }

  function vote(uint proposalId, uint mode) public onlyRole(MEMBER_ROLE) {
    Proposal storage proposal = proposals[proposalId];
    require(proposal.actions.length > 0, "Voting not permitted: Proposal does not exist");
    require(block.timestamp <= proposal.deadline, "Voting not permitted: Voting period has ended");
    require(!hasVoted(proposalId, msg.sender), "Voting not permitted: Voter has already voted");
    proposal.hasVoted[msg.sender] = true;
    
    if (mode == uint8(VoteType.Against)) {
      proposal.noVotes += 1;
    } else if (mode == uint8(VoteType.For)) {
      proposal.yesVotes += 1;
    } else if (mode == uint8(VoteType.Abstain)) {
      proposal.abstainVotes += 1;
    } else {
      revert("Voting not permitted: Invalid value for VoteType (0 = YES, 1 = NO, 2 = ABSTAIN)");
    }

    emit Voted(proposalId, msg.sender, mode);
  }

  function executeProposal(uint _proposalId) public payable {
    Proposal storage proposal = proposals[_proposalId];
    require(proposal.actions.length > 0, "Execution not permitted: Proposal does not exist");
    require(!proposal.executed, "Execution not permitted: Proposal already executed");

    uint transactionTotal = 0;
    for (uint256 index = 0; index < proposal.transactionValues.length; index++) {
      transactionTotal += proposal.transactionValues[index];
    }

    require(transactionTotal <= address(this).balance, "Execution not permitted: Pool does not have enough funds");
    require((proposal.noVotes * 2) <= members.length, "Execution not permitted: Majority voted against execution");
    require((proposal.yesVotes * 2) >= members.length || proposal.deadline <= block.timestamp, "Execution not permitted: Voting is still allowed");
    
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

  function addMember(address _newMember) external onlyRole(ADMIN_ROLE) {
    members.push(_newMember);
    _grantRole(MEMBER_ROLE, _newMember);
  }

  function removeMember(address _member) external onlyRole(ADMIN_ROLE) {
    for (uint256 index = 0; index < members.length; index++) {
      if (members[index] == _member) {
        members[index] = members[members.length - 1];
        delete members[members.length - 1];
        members.pop();
      }
    }
    _revokeRole(MEMBER_ROLE, _member);
  }

  function poolMembers() public view returns(address[] memory) {
    return members;
  }

  function addAdmin(address _newAdmin) external onlyRole(ADMIN_ROLE) {
    _grantRole(ADMIN_ROLE, _newAdmin);
  }

  function removeAdmin(address _admin) external onlyRole(ADMIN_ROLE) {
    _revokeRole(ADMIN_ROLE, _admin);
  }

  function getAllProposalIds() public view returns(uint[] memory) {
    return proposalIds;
  }

  function getAllOpenProposalIds() public view returns(uint[] memory) {
    return openProposalIds;
  }

  function getProposal(uint _proposalId) public view returns(string memory title, string memory description, uint transactionCount, uint deadline, uint yesVotes, uint noVotes, uint abstainVotes, uint createdAt, bool executed) {
    Proposal storage proposal = proposals[_proposalId];
    return (proposal.title, proposal.description, proposal.actions.length, proposal.deadline, proposal.yesVotes, proposal.noVotes, proposal.abstainVotes, proposal.createdAt, proposal.executed);
  }

  function getProposalTransaction(uint _proposalId, uint _transactionIndex) public view returns(string memory action, bytes memory param, uint transactionValue, address contractAddress) {
    Proposal storage proposal = proposals[_proposalId];
    return (proposal.actions[_transactionIndex], proposal.params[_transactionIndex], proposal.transactionValues[_transactionIndex], proposal.contractAddresses[_transactionIndex]);
  }

  function liquidatePool() external onlyRole(ADMIN_ROLE) {
    _distributeAllTokensEvenly(members);
    _distributeMaticEvenly(members);
    selfdestruct(payable(msg.sender));
  }
}