const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

describe('POOL JOURNEY', () => {
  let poolLauncher, owner, user1, user2, user3;

  beforeEach(async () => {
    const PoolLauncher = await ethers.getContractFactory('PoolLauncher');
    poolLauncher = await PoolLauncher.deploy();
    [owner, user1, user2, user3, _] = await ethers.getSigners();
  });

  describe('Create New WunderPool', () => {
    
    let wunderPool;
    beforeEach(async () => {
      await poolLauncher.createNewPool("CryptoApes");
      const poolAddress = (await poolLauncher.allPools())[0];
      wunderPool = await ethers.getContractAt("WunderPool", poolAddress, owner);
    });

    it('Should launch a new WunderPool', async () => {
      expect((await poolLauncher.allPools()).length).to.equal(1);
      expect((await poolLauncher.poolsOfCreator(owner.address)).length).to.equal(1);
      expect(await wunderPool.poolName()).to.equal("CryptoApes");
    });

    describe('Add Members', () => {
      
      beforeEach(async () => {
        await wunderPool.addAdmin(user1.address);
        await wunderPool.addMember(user1.address);
        await wunderPool.addMember(user2.address);
      });

      it('Should allow for role management', async () => {
        await expect(wunderPool.connect(user2).addMember(user3.address)).to.be.reverted;
        await wunderPool.removeAdmin(user1.address);
        await expect(wunderPool.connect(user1).addAdmin(user2.address)).to.be.reverted;
      });

      describe('Use the Pool', () => {
        let wunderSwapper, sunMinerToken, abiCoder;
        beforeEach(async () => {
          abiCoder = new ethers.utils.AbiCoder();
          const WunderSwapper = await ethers.getContractFactory('WunderSwapper');
          wunderSwapper = await WunderSwapper.deploy();
          sunMinerToken = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
          await owner.sendTransaction({to: wunderPool.address, value: ethers.utils.parseEther("2.0")})
        });

        it('Members can propose to Ape into a Token', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), ethers.utils.parseEther("0.01"), 1846183041);
          expect((await wunderPool.getAllProposalIds()).length).to.equal(1);
        });

        it('Members can vote for Proposals', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), ethers.utils.parseEther("0.01"), 1846183041);
          await wunderPool.vote(0, 0);
          await wunderPool.connect(user1).vote(0, 1);
          await wunderPool.connect(user2).vote(0, 2);
          const {yesVotes, noVotes, abstainVotes} = await wunderPool.proposals(0);
          expect(yesVotes).to.equal(1);
          expect(noVotes).to.equal(1);
          expect(abstainVotes).to.equal(1);
        });

        it('Proposal gets executed once Majority is reached', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), ethers.utils.parseEther("0.01"), 1846183041);
          await wunderPool.vote(0, 0);
          await wunderPool.connect(user1).vote(0, 0);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          const sunMinerBalance = await sunMinerToken.balanceOf(wunderPool.address);
          expect(sunMinerBalance).to.be.gt(0);
        });

        it('Token can be added to the Pool', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), ethers.utils.parseEther("0.01"), 1846183041);
          await wunderPool.vote(0, 0);
          await wunderPool.connect(user1).vote(0, 0);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          await wunderPool.addToken(sunMinerToken.address);
          expect((await wunderPool.getOwnedTokenAddresses()).length).to.equal(1);
        });

        it('Token can be added to the Pool Programatically', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [wunderSwapper.address, wunderPool.address], ["buyTokens(address)", "addToken(address)"], [abiCoder.encode(["address"], [sunMinerToken.address]), abiCoder.encode(["address"], [sunMinerToken.address])], [ethers.utils.parseEther("0.01"), 0], 1846183041);
          await wunderPool.vote(0, 0);
          await wunderPool.connect(user1).vote(0, 0);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          expect((await wunderPool.getOwnedTokenAddresses()).length).to.equal(1);
        });

        it('Members can propose to Sell a Token', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), ethers.utils.parseEther("0.01"), 1846183041);
          await wunderPool.vote(0, 0);
          await wunderPool.connect(user1).vote(0, 0);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          
          const currentBalance = await sunMinerToken.balanceOf(wunderPool.address);
          await wunderPool.connect(user2).createMultiActionProposal("Let's Sell SunMinerToken", "SunMinerToken Not going anywhere", [sunMinerToken.address, wunderSwapper.address], ["transfer(address,uint256)", "sellTokens(address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, currentBalance]), abiCoder.encode(["address", "uint"], [sunMinerToken.address, currentBalance])], [0, 0], 1846183041);
          await wunderPool.vote(1, 0);
          await wunderPool.connect(user2).vote(1, 0);
          await expect(wunderPool.executeProposal(1)).to.not.be.reverted;
          
          const balanceAfterSell = await sunMinerToken.balanceOf(wunderPool.address);
          expect(balanceAfterSell).to.equal(0);
        });

        describe('Liquidate the Pool', () => {
          let maticBalance, tokenBalance, memberTokenBalance, memberMaticBalance, provider;
          beforeEach(async () => {
            await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [wunderSwapper.address, wunderPool.address], ["buyTokens(address)", "addToken(address)"], [abiCoder.encode(["address"], [sunMinerToken.address]), abiCoder.encode(["address"], [sunMinerToken.address])], [ethers.utils.parseEther("0.01"), 0], 1846183041);
            await wunderPool.vote(0, 0);
            await wunderPool.connect(user1).vote(0, 0);
            await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
            provider = wunderPool.provider;
            tokenBalance = await sunMinerToken.balanceOf(wunderPool.address);
            maticBalance = await provider.getBalance(wunderPool.address);
            memberTokenBalance = await sunMinerToken.balanceOf(user1.address);
            memberMaticBalance = await provider.getBalance(user1.address);
          });

          it('Should distribute MATIC equally to all members', async () => {
            const tx = await wunderPool.liquidatePool();
            const events = (await tx.wait()).events;
            const transferEvents = events.filter((event) => event.event == "MaticWithdrawed");
            expect(transferEvents.length).to.equal(3);
            const receivers = transferEvents.map((event) => event.args.receiver);
            expect(receivers).to.have.members([owner.address, user1.address, user2.address])
            const distributedAmounts = transferEvents.map((event) => event.args.amount);
            expect(distributedAmounts[0]).to.equal(distributedAmounts[1]);
            expect(distributedAmounts[1]).to.equal(distributedAmounts[2]);
            expect(distributedAmounts.reduce((a, b) => a.add(b))).to.be.gt(maticBalance.sub(2))
            expect(memberMaticBalance.add(distributedAmounts[1])).to.equal(await provider.getBalance(user1.address));
          });

          it('Should distribute Tokens equally to all members', async () => {
            const tx = await wunderPool.liquidatePool();
            const events = (await tx.wait()).events;
            const transferEvents = events.filter((event) => event.event == "TokensWithdrawed");
            expect(transferEvents.length).to.equal(3);
            const receivers = transferEvents.map((event) => event.args.receiver);
            expect(receivers).to.have.members([owner.address, user1.address, user2.address])
            const distributedAmounts = transferEvents.map((event) => event.args.amount);
            expect(distributedAmounts[0]).to.equal(distributedAmounts[1]);
            expect(distributedAmounts[1]).to.equal(distributedAmounts[2]);
            expect(distributedAmounts.reduce((a, b) => a.add(b))).to.be.gt(tokenBalance.sub(2))
            expect(memberTokenBalance.add(distributedAmounts[1])).to.equal(await sunMinerToken.balanceOf(user1.address));
          });

          it('Should destroy the Pool', async () => {
            await wunderPool.liquidatePool();
            await expect(wunderPool.poolName()).to.be.reverted;
          });
        });
      });
    
    });
  
  });
});
