const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

const proposal = {
  title: 'Lets Swap MATIC for Dai',
  description: 'Dai will go MOOOON',
  contractAddress: '0xe11e61b3A603Fb1d4d208574bfc25cF69177BB0C',
  action: 'buyTokens(address)',
  params: '0x0000000000000000000000008f3cf7ad23cd3cadbd9735aff958023239c6a063',
  transactionValue: matic("0.69"),
  deadline: 1846183041
}

const nullAddress = "0x0000000000000000000000000000000000000000";

describe('WUNDER POOL CONTRACT', () => {
  let poolLauncher, freePool, paidPool, owner, user1, user2;

  beforeEach(async () => {
    [owner, user1, user2, _] = await ethers.getSigners();
    poolLauncher = await (await ethers.getContractFactory('PoolLauncherBeta')).deploy();
    await poolLauncher.createNewPool("PublicApes", 0, "PublicApeToken", "PAT", {value: 0});
    await poolLauncher.createNewPool("PrivateApes", matic(50), "PrivateApeToken", "PAT", {value: matic(100)});
    const [free, paid] = await poolLauncher.allPools();
    freePool = await ethers.getContractAt("WunderPoolBeta", free, owner);
    paidPool = await ethers.getContractAt("WunderPoolBeta", paid, owner);
  });

  describe('Deployment', () => {
    it('Should Set the correct Parameters', async () => {
      expect(await freePool.name()).to.equal("PublicApes");
      expect(await freePool.launcherAddress()).to.equal(poolLauncher.address);
      expect(await freePool.entryBarrier()).to.equal(0);
      expect(await paidPool.entryBarrier()).to.equal(matic(50));
    });
  });

  describe('Roles', () => {
    it('Member cannot join twice', async () => {
      expect((await freePool.poolMembers()).length).to.equal(1)
      await expect(freePool.enterPool({value: 0})).to.be.revertedWith("Is already a Member");
      expect((await freePool.poolMembers()).length).to.equal(1)
    });

    it('Member should be able to create Proposal', async () => {
      await expect(freePool.connect(user1).createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.be.reverted;
      await freePool.connect(user1).enterPool({value: 0});
      await expect(freePool.connect(user1).createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.not.be.reverted;
    });

    it('Member should be able to vote', async () => {
      await freePool.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      await expect(freePool.connect(user1).vote(0, 1)).to.be.reverted;
      await freePool.connect(user1).enterPool({value: 0});
      await expect(freePool.connect(user1).vote(0, 1)).to.not.be.reverted;
    });
  })

  describe('Barrier', () => {
    it('Anyone can Join a Free Pool', async () => {
      await expect(freePool.connect(user1).enterPool({value: 0})).to.not.be.reverted;
      expect(await freePool.poolMembers()).to.have.members([owner.address, user1.address]);
    });

    it('Anyone can join a Paid Pool if the fee is high enough', async () => {
      await expect(paidPool.connect(user1).enterPool({value: 0})).to.be.revertedWith("Your stake is not high enough");
      await expect(paidPool.connect(user1).enterPool({value: matic(49)})).to.be.revertedWith("Your stake is not high enough");
      await expect(paidPool.connect(user1).enterPool({value: matic(50)})).to.not.be.reverted;
      expect(await paidPool.poolMembers()).to.have.members([owner.address, user1.address]);
    });
  })

  describe('Proposals', () => {
    it('Should revert for missing Parameters', async () => {
      await expect(paidPool.createProposal("", proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.be.revertedWith("Invalid Proposal: Missing Parameter Title");
      await expect(paidPool.createProposal(proposal.title, proposal.description, nullAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline)).to.be.revertedWith("Invalid Proposal: Missing Parameter Contract Address");
      await expect(paidPool.createProposal(proposal.title, proposal.description, proposal.contractAddress, "", proposal.params, proposal.transactionValue, proposal.deadline)).to.be.revertedWith("Invalid Proposal: Missing Parameter Action");
      await expect(paidPool.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, 0)).to.be.revertedWith("Invalid Proposal: Deadline needs to be in the Future");
    });

    it('Should revert for invalid Multi Action Parameters', async () => {
      await expect(paidPool.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress, proposal.contractAddress], [proposal.action], [proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(paidPool.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress], [proposal.action, proposal.action], [proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(paidPool.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress], [proposal.action], [proposal.params, proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(paidPool.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress], [proposal.action], [proposal.params], [proposal.transactionValue, proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
      await expect(paidPool.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress, proposal.contractAddress], [proposal.action, proposal.action], [proposal.params], [proposal.transactionValue], proposal.deadline)).to.be.revertedWith("Invalid Proposal: Inconsistens amount of transactions");
    });

    it('Should create a new Proposal with the given Parameters', async () => {
      await paidPool.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      const {title, description, transactionCount, deadline, yesVotes, noVotes, executed} = await paidPool.getProposal(0);
      expect(title).to.equal(proposal.title);
      expect(description).to.equal(proposal.description);
      expect(transactionCount).to.equal(1);
      expect(deadline).to.equal(proposal.deadline);
      expect(yesVotes).to.equal(0);
      expect(noVotes).to.equal(0);
      expect(executed).to.equal(false);
      
      for (let i = 0; i < transactionCount.length; i++) {
        const {action, param, transactionValue, contractAddress} = await paidPool.getProposalTransaction(0, i);
        expect(contractAddress).to.equal(proposal.contractAddress);
        expect(action).to.equal(proposal.action);
        expect(param).to.equal(proposal.params);
        expect(transactionValue).to.equal(proposal.transactionValue);
      }
    });

    it('Should create a new Multi Action Proposal with the given Parameters', async () => {
      await paidPool.createMultiActionProposal(proposal.title, proposal.description, [proposal.contractAddress, proposal.contractAddress], [proposal.action, proposal.action], [proposal.params, proposal.params], [proposal.transactionValue, proposal.transactionValue], proposal.deadline);
      const {title, description, transactionCount, deadline, yesVotes, noVotes, executed} = await paidPool.getProposal(0);
      expect(title).to.equal(proposal.title);
      expect(description).to.equal(proposal.description);
      expect(transactionCount).to.equal(2);
      expect(deadline).to.equal(proposal.deadline);
      expect(yesVotes).to.equal(0);
      expect(noVotes).to.equal(0);
      expect(executed).to.equal(false);
      
      for (let i = 0; i < transactionCount.length; i++) {
        const {action, param, transactionValue, contractAddress} = await paidPool.getProposalTransaction(0, i);
        expect(contractAddress).to.equal(proposal.contractAddress);
        expect(action).to.equal(proposal.action);
        expect(param).to.equal(proposal.params);
        expect(transactionValue).to.equal(proposal.transactionValue);
      }
    });

    it('Should emit the NewProposal Event', async () => {
      const tx = await paidPool.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      await expect(tx).to.emit(paidPool, 'NewProposal').withArgs(0, owner.address, proposal.title);
    });
  });

  describe('Voting', () => {
    let govToken;
    beforeEach(async () => {
      await paidPool.connect(user1).enterPool({value: matic(50)});
      await paidPool.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, proposal.deadline);
      const govTokenAddress = await paidPool.governanceToken();
      govToken = await ethers.getContractAt("PoolGovernanceTokenBeta", govTokenAddress, owner);
    });

    it('Voting should revert for Non Existing Proposal', async () => {
      await expect(paidPool.vote(1, 1)).to.be.revertedWith("Voting not permitted: Proposal does not exist");
    });

    it('Votes should be counted in Proposal', async () => {
      await paidPool.vote(0, 1);
      const {yesVotes, noVotes} = await paidPool.getProposal(0);
      expect(yesVotes).to.equal(100);
      expect(noVotes).to.equal(0);
      await paidPool.connect(user1).vote(0, 2);
      const {yesVotes: _yesVotes, noVotes: _noVotes} = await paidPool.getProposal(0);
      expect(_yesVotes).to.equal(100);
      expect(_noVotes).to.equal(50);
    });

    it('Votes should be counted correctly after Governance Token Transfer', async () => {
      await paidPool.vote(0, 1);
      await paidPool.connect(user1).vote(0, 2);
      await govToken.transfer(user1.address, 10);
      const {yesVotes, noVotes} = await paidPool.getProposal(0);
      expect(yesVotes).to.equal(90);
      expect(noVotes).to.equal(60);
    });

    it('Should return what a user has voted for', async () => {
      await paidPool.vote(0, 1);
      expect(await paidPool.hasVoted(0, owner.address)).to.equal(1);
      await paidPool.connect(user1).vote(0, 2);
      expect(await paidPool.hasVoted(0, user1.address)).to.equal(2);
    });

    it('Should emit the Voted Event', async () => {
      const tx = await paidPool.vote(0, 1);
      await expect(tx).to.emit(paidPool, 'Voted').withArgs(0, owner.address, 1);
    });

    it('User should not be able to vote twice for the same Proposal', async () => {
      await paidPool.vote(0, 1);
      await expect(paidPool.vote(0, 1)).to.be.revertedWith("Voting not permitted: Voter has already voted");
    });

    it('User should not be able to vote once proposal deadline is exceeded', async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      await paidPool.createProposal(proposal.title, proposal.description, proposal.contractAddress, proposal.action, proposal.params, proposal.transactionValue, timestampBefore + 2);
      await paidPool.vote(0, 1);
      await expect(paidPool.vote(1, 1)).to.be.revertedWith("Voting not permitted: Voting period has ended");
    });

    it('Voting should revert for Non Existing Voting Mode', async () => {
      await expect(paidPool.vote(0, 0)).to.be.revertedWith("Voting not permitted: Invalid value for VoteType (1 = YES, 2 = NO)");
      await expect(paidPool.vote(0, 3)).to.be.revertedWith("Voting not permitted: Invalid value for VoteType (1 = YES, 2 = NO)");
    });
  });

  describe('Execution', () => {
    let testContract, abiCoder;
    beforeEach(async () => {
      abiCoder = new ethers.utils.AbiCoder()
      
      await paidPool.connect(user1).enterPool({value: matic(50)});
      await paidPool.connect(user2).enterPool({value: matic(70)});
      
      const TestExecute = await ethers.getContractFactory('TestExecute');
      testContract = await TestExecute.deploy();
      
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint", "uint"], [50, 19]), 0, proposal.deadline);
    });

    it('Should revert for Non Existing Proposal', async () => {
      await expect(paidPool.executeProposal(1)).to.be.revertedWith("Execution not permitted: Proposal does not exist");
    });

    it('Should revert if majority voted against it', async () => {
      await paidPool.connect(user1).vote(0, 2);
      await paidPool.connect(user2).vote(0, 2);
      await expect(paidPool.executeProposal(0)).to.be.revertedWith("Execution not permitted: Majority voted against execution");
    });

    it('Should revert if voting is still allowed and no majority is achieved', async () => {
      await expect(paidPool.executeProposal(0)).to.be.revertedWith("Execution not permitted: Voting is still allowed");
    });

    it('Should revert if proposal transaction value is greater than pools balance', async () => {
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "returnSenderAndValue()", "0x", matic(300), proposal.deadline);
      await paidPool.vote(1, 1);
      await paidPool.connect(user2).vote(1, 1);
      await expect(paidPool.executeProposal(1)).to.be.revertedWith("Execution not permitted: Pool does not have enough funds");
    });

    it('Should pass if deadline is over', async () => {
      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint", "uint"], [50, 19]), 0, timestampBefore + 2);
      await expect(paidPool.executeProposal(1)).to.not.be.reverted;
    });

    it('Should pass if a majority was achieved', async () => {
      await expect(paidPool.executeProposal(0)).to.be.revertedWith("Execution not permitted: Voting is still allowed");
      await paidPool.connect(user1).vote(0, 1);
      await expect(paidPool.executeProposal(0)).to.be.revertedWith("Execution not permitted: Voting is still allowed");
      await paidPool.connect(user2).vote(0, 1);
      await expect(paidPool.executeProposal(0)).to.not.be.reverted;
    });

    it('Should execute a correct call replacing msg.sender and passing msg.value to the function', async () => {
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "returnSenderAndValue()", "0x", proposal.transactionValue, proposal.deadline);
      await paidPool.connect(user1).vote(1, 1);
      await paidPool.connect(user2).vote(1, 1);
      const expectedData = abiCoder.encode(["address", "uint"], [ paidPool.address, proposal.transactionValue ]);
      await expect(paidPool.executeProposal(1)).to.emit(paidPool, 'ProposalExecuted').withArgs(1, owner.address, [expectedData]);
    });

    it('Should pass in correct params and return a value', async () => {
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint", "uint"], [50, 19]), 0, proposal.deadline);
      await paidPool.connect(user1).vote(1, 1);
      await paidPool.connect(user2).vote(1, 1);
      const expectedData = abiCoder.encode(["uint"], [69]);
      await expect(paidPool.executeProposal(1)).to.emit(paidPool, 'ProposalExecuted').withArgs(1, owner.address, [expectedData]);
    });

    it('Should be able to change State of contract', async () => {
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "updateString(string)", abiCoder.encode(["string"], ["Moin Meister"]), 0, proposal.deadline);
      await paidPool.connect(user1).vote(1, 1);
      await paidPool.connect(user2).vote(1, 1);
      await paidPool.executeProposal(1);
      expect(await testContract.changeMe()).to.equal("Moin Meister");
    });

    it('Should revert if called function reverts', async () => {
      await paidPool.createProposal(proposal.title, proposal.description, testContract.address, "addTwo(uint256,uint256)", abiCoder.encode(["uint"], [50]), proposal.transactionValue, proposal.deadline);
      await paidPool.connect(user1).vote(1, 1);
      await paidPool.connect(user2).vote(1, 1);
      await expect(paidPool.executeProposal(1)).to.be.revertedWith("Execution failed");
    });

    it('Should not execute a proposal twice', async () => {
      await paidPool.connect(user1).vote(0, 1);
      await paidPool.connect(user2).vote(0, 1);
      await paidPool.executeProposal(0);
      await expect(paidPool.executeProposal(0)).to.be.revertedWith("Execution not permitted: Proposal already executed");
    });

    it('Should remove the proposal from openProposalIds on execution', async () => {
      await paidPool.connect(user1).vote(0, 1);
      await paidPool.connect(user2).vote(0, 1);
      expect((await paidPool.getAllOpenProposalIds()).length).to.equal(1);
      await paidPool.executeProposal(0);
      expect((await paidPool.getAllOpenProposalIds()).length).to.equal(0);
    });
  });
});
