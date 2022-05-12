const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const proposal = {
  title: 'Lets Swap MATIC for Dai',
  description: 'Dai will go MOOOON',
  contractAddress: '0xe11e61b3A603Fb1d4d208574bfc25cF69177BB0C',
  action: 'buyTokens(address)',
  params: '0x0000000000000000000000008f3cf7ad23cd3cadbd9735aff958023239c6a063',
  transactionValue: ethers.utils.parseEther("0.69"),
  deadline: 1846183041
}

const nullAddress = "0x0000000000000000000000000000000000000000";

describe('WUNDER POOL CONTRACT', () => {
  let WunderPool, contract, owner, user1, user2;

  beforeEach(async () => {
    WunderPool = await ethers.getContractFactory('WunderPool');
    [owner, user1, user2, _] = await ethers.getSigners();
    contract = await WunderPool.deploy("Crypto Apes", owner.address, nullAddress);
    await owner.sendTransaction({to: contract.address, value: ethers.utils.parseEther("2.0")})
  });

  describe('Deployment', () => {
    it('Should give the creator Admin and Member Roles', async () => {
      await contract.addMember(user1.address);
      expect((await contract.poolMembers()).length).to.equal(2)
    });
  });

  describe('Roles', () => {
    it('Admin should be able to add Admins', async () => {
      await contract.addAdmin(user1.address);
      await contract.connect(user1).addMember(user2.address);
      expect((await contract.poolMembers()).length).to.equal(2);
      await expect(contract.connect(user2).addAdmin(user2.address)).to.be.reverted;
    });

    it('Admin should be able to remove Admins', async () => {
      await contract.addAdmin(user1.address);
      await contract.removeAdmin(user1.address);
      await expect(contract.connect(user1).addMember(user2.address)).to.be.reverted;
      await expect(contract.connect(user1).removeAdmin(owner.address)).to.be.reverted;
    });

    it('Admin should be able to add Members', async () => {
      await contract.addMember(user1.address);
      expect((await contract.poolMembers()).length).to.equal(2)
      await expect(contract.connect(user1).addMember(user2.address)).to.be.reverted;
    });

    it('Member cannot be added twice', async () => {
      await contract.addMember(user1.address);
      expect((await contract.poolMembers()).length).to.equal(2)
      await expect(contract.addMember(user1.address)).to.be.revertedWith("Is already a Member");
    });

    it('Admin should be able to remove Members', async () => {
      await contract.addMember(user1.address);
      expect((await contract.poolMembers()).length).to.equal(2);
      await expect(contract.connect(user1).removeMember(owner.address)).to.be.reverted;
      await contract.removeMember(user1.address);
      expect((await contract.poolMembers()).length).to.equal(1);
    });

    it('Member should be able to create Proposal', async () => {
      await expect(contract.connect(user1).createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.be.reverted;
      await contract.addMember(user1.address);
      await expect(contract.connect(user1).createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.not.be.reverted;
    });

    it('Member should be able to vote', async () => {
      await contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      await expect(contract.connect(user1).vote(0, 0)).to.be.reverted;
      await contract.addMember(user1.address);
      await expect(contract.connect(user1).vote(0, 0)).to.not.be.reverted;
    });
  })

  describe('Proposals', () => {
    it('Should revert for missing Parameters', async () => {
      await expect(contract.createProposal("", proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.be.revertedWith("Invalid Proposal: Missing Parameter Title");
      await expect(contract.createProposal(proposal.title, proposal.description, nullAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.be.revertedWith("Invalid Proposal: Missing Parameter Contract Address");
      await expect(contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, "", proposal.params, proposal.transactionValue, proposal.deadline)).to.be.revertedWith("Invalid Proposal: Missing Parameter Action");
      await expect(contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, 0)).to.be.revertedWith("Invalid Proposal: Missing Parameter Deadline");
      await expect(contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, 10)).to.be.revertedWith("Invalid Proposal: Deadline needs to be in the Future");
    });

    it('Should revert for invalid Multi Action Parameters', async () => {
      await expect(contract.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress, proposal.contractAddress], [proposal.action], [proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(contract.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress], [proposal.action, proposal.action], [proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(contract.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress], [proposal.action], [proposal.params, proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(contract.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress], [proposal.action], [proposal.params], [proposal.transactionValue, proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(contract.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress, proposal.contractAddress], [proposal.action, proposal.action], [proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
    });

    it('Should create a new Proposal with the given Parameters', async () => {
      await contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      const {title, description, transactionCount, deadline, yesVotes, noVotes, abstainVotes, executed} = await contract.getProposal(0);
      expect(title).to.equal(proposal.title);
      expect(description).to.equal(proposal.description);
      expect(transactionCount).to.equal(1);
      expect(deadline).to.equal(proposal.deadline);
      expect(yesVotes).to.equal(0);
      expect(noVotes).to.equal(0);
      expect(abstainVotes).to.equal(0);
      expect(executed).to.equal(false);
      
      for (let i = 0; i < transactionCount.length; i++) {
        const {action, param, transactionValue, contractAddress} = await contract.getProposalTransaction(0, i);
        expect(contractAddress).to.equal(proposal.contractAddress);
        expect(action).to.equal(proposal.action);
        expect(param).to.equal(proposal.params);
        expect(transactionValue).to.equal(proposal.transactionValue);
      }
    });

    it('Should create a new Multi Action Proposal with the given Parameters', async () => {
      await contract.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress, proposal.contractAddress], [proposal.action, proposal.action], [proposal.params, proposal.params], [proposal.transactionValue, proposal.transactionValue], proposal.deadline);
      const {title, description, transactionCount, deadline, yesVotes, noVotes, abstainVotes, executed} = await contract.getProposal(0);
      expect(title).to.equal(proposal.title);
      expect(description).to.equal(proposal.description);
      expect(transactionCount).to.equal(2);
      expect(deadline).to.equal(proposal.deadline);
      expect(yesVotes).to.equal(0);
      expect(noVotes).to.equal(0);
      expect(abstainVotes).to.equal(0);
      expect(executed).to.equal(false);
      
      for (let i = 0; i < transactionCount.length; i++) {
        const {action, param, transactionValue, contractAddress} = await contract.getProposalTransaction(0, i);
        expect(contractAddress).to.equal(proposal.contractAddress);
        expect(action).to.equal(proposal.action);
        expect(param).to.equal(proposal.params);
        expect(transactionValue).to.equal(proposal.transactionValue);
      }
    });

    it('Should emit the NewProposal Event', async () => {
      const tx = await contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      await expect(tx).to.emit(contract, 'NewProposal').withArgs(0, owner.address, proposal.title);
    });
  });

  describe('Voting', () => {
    beforeEach(async () => {
      await contract.addMember(user1.address);
      await contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
    });

    it('Voting should revert for Non Existing Proposal', async () => {
      await expect(contract.vote(1, 0)).to.be.revertedWith("Voting not permitted: Proposal does not exist");
    });

    it('Votes should be counted in Proposal', async () => {
      await contract.vote(0, 0);
      const {yesVotes, noVotes, abstainVotes} = await contract.proposals(0);
      expect(yesVotes).to.equal(1);
      expect(noVotes).to.equal(0);
      expect(abstainVotes).to.equal(0);
      await contract.connect(user1).vote(0, 1);
      const {yesVotes: _yesVotes, noVotes: _noVotes, abstainVotes: _abstainVotes} = await contract.proposals(0);
      expect(_yesVotes).to.equal(1);
      expect(_noVotes).to.equal(1);
      expect(_abstainVotes).to.equal(0);
    });

    it('Should emit the Voted Event', async () => {
      const tx = await contract.vote(0, 0);
      await expect(tx).to.emit(contract, 'Voted').withArgs(0, owner.address, 0);
    });

    it('User should not be able to vote twice for the same Proposal', async () => {
      await contract.vote(0, 0);
      await expect(contract.vote(0, 0)).to.be.revertedWith("Voting not permitted: Voter has already voted");
    });

    it('User should not be able to vote once proposal deadline is exceeded', async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      await contract.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, timestampBefore + 2);
      await contract.vote(0, 0);
      await expect(contract.vote(1, 0)).to.be.revertedWith("Voting not permitted: Voting period has ended");
    });

    it('Voting should revert for Non Existing Voting Mode', async () => {
      await expect(contract.vote(0, 3)).to.be.revertedWith("Voting not permitted: Invalid value for VoteType (0 = YES, 1 = NO, 2 = ABSTAIN)");
    });
  });

  describe('Execution', () => {
    let TestExecute, testContract, abiCoder;
    beforeEach(async () => {
      abiCoder = new ethers.utils.AbiCoder()
      
      await contract.addMember(user1.address);
      await contract.addMember(user2.address);
      
      TestExecute = await ethers.getContractFactory('TestExecute');
      testContract = await TestExecute.deploy();
      
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint", "uint"], [50, 19]), 0, proposal.deadline);
    });

    it('Should revert for Non Existing Proposal', async () => {
      await expect(contract.executeProposal(1)).to.be.revertedWith("Execution not permitted: Proposal does not exist");
    });

    it('Should revert if majority voted against it', async () => {
      await contract.connect(user1).vote(0, 1);
      await contract.connect(user2).vote(0, 1);
      await expect(contract.executeProposal(0)).to.be.revertedWith("Execution not permitted: Majority voted against execution");
    });

    it('Should revert if voting is still allowed and no majority is achieved', async () => {
      await expect(contract.executeProposal(0)).to.be.revertedWith("Execution not permitted: Voting is still allowed");
    });

    it('Should revert if proposal transaction value is greater than pools balance', async () => {
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "returnSenderAndValue()", "0x", ethers.utils.parseEther("3.0"), proposal.deadline);
      await expect(contract.executeProposal(1)).to.be.revertedWith("Execution not permitted: Pool does not have enough funds");
    });

    it('Should pass if deadline is over', async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint", "uint"], [50, 19]), 0, timestampBefore + 2);
      await expect(contract.executeProposal(1)).to.not.be.reverted;
    });

    it('Should pass if a majority was achieved', async () => {
      await expect(contract.executeProposal(0)).to.be.revertedWith("Execution not permitted: Voting is still allowed");
      await contract.connect(user1).vote(0, 0);
      await expect(contract.executeProposal(0)).to.be.revertedWith("Execution not permitted: Voting is still allowed");
      await contract.connect(user2).vote(0, 0);
      await expect(contract.executeProposal(0)).to.not.be.reverted;
    });

    it('Should execute a correct call replacing msg.sender and passing msg.value to the function', async () => {
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "returnSenderAndValue()", "0x", proposal.transactionValue, proposal.deadline);
      await contract.connect(user1).vote(1, 0);
      await contract.connect(user2).vote(1, 0);
      const expectedData = abiCoder.encode(["address", "uint"], [ contract.address, proposal.transactionValue ]);
      await expect(contract.executeProposal(1)).to.emit(contract, 'ProposalExecuted').withArgs(1, owner.address, [expectedData]);
    });

    it('Should pass in correct params and return a value', async () => {
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint", "uint"], [50, 19]), 0, proposal.deadline);
      await contract.connect(user1).vote(1, 0);
      await contract.connect(user2).vote(1, 0);
      const expectedData = abiCoder.encode(["uint"], [69]);
      await expect(contract.executeProposal(1)).to.emit(contract, 'ProposalExecuted').withArgs(1, owner.address, [expectedData]);
    });

    it('Should be able to change State of contract', async () => {
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "updateString(string)", abiCoder.encode(["string"], ["Moin Meister"]), 0, proposal.deadline);
      await contract.connect(user1).vote(1, 0);
      await contract.connect(user2).vote(1, 0);
      await contract.executeProposal(1);
      expect(await testContract.changeMe()).to.equal("Moin Meister");
    });

    it('Should revert if called function reverts', async () => {
      await contract.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint"], [50]), proposal.transactionValue, proposal.deadline);
      await contract.connect(user1).vote(1, 0);
      await contract.connect(user2).vote(1, 0);
      await expect(contract.executeProposal(1)).to.be.revertedWith("Execution failed");
    });

    it('Should not execute a proposal twice', async () => {
      await contract.connect(user1).vote(0, 0);
      await contract.connect(user2).vote(0, 0);
      await contract.executeProposal(0);
      await expect(contract.executeProposal(0)).to.be.revertedWith("Execution not permitted: Proposal already executed");
    });

    it('Should remove the proposal from openProposalIds on execution', async () => {
      await contract.connect(user1).vote(0, 0);
      await contract.connect(user2).vote(0, 0);
      expect((await contract.getAllOpenProposalIds()).length).to.equal(1);
      await contract.executeProposal(0);
      expect((await contract.getAllOpenProposalIds()).length).to.equal(0);
    });
  });
});
