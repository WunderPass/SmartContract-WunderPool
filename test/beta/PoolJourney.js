const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('POOL JOURNEY', () => {
  let poolLauncher, owner, user1, user2, user3;

  beforeEach(async () => {
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherBeta');
    poolLauncher = await PoolLauncher.deploy();
    [owner, user1, user2, user3, _] = await ethers.getSigners();
  });

  describe('Create New WunderPool', () => {
    
    let wunderPool, govToken;
    beforeEach(async () => {
      await poolLauncher.createNewPool("CryptoApes", matic(10), "CryptoApesToken", "CAT", {value: matic(100)});
      const poolAddress = (await poolLauncher.allPools())[0];
      wunderPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
      const govTokenAddress = await wunderPool.governanceToken();
      govToken = await ethers.getContractAt("PoolGovernanceTokenBeta", govTokenAddress, owner);
    });

    it('Should launch a new WunderPool', async () => {
      expect((await poolLauncher.allPools()).length).to.equal(1);
      expect((await poolLauncher.poolsOfMember(owner.address)).length).to.equal(1);
      expect(await wunderPool.name()).to.equal("CryptoApes");
      expect(await wunderPool.provider.getBalance(wunderPool.address)).to.equal(matic(100))
    });

    it('Should launch a new Governance Token', async () => {
      expect(await govToken.name()).to.equal("CryptoApesToken");
      expect(await govToken.symbol()).to.equal("CAT");
      expect(await govToken.decimals()).to.equal(0);
      expect(await govToken.balanceOf(owner.address)).to.equal(100);
      expect(await govToken.launcherAddress()).to.equal(poolLauncher.address);
      expect(await govToken.poolAddress()).to.equal(wunderPool.address);
      expect(await govToken.price()).to.equal(matic(1));
    });

    describe('Joining the Pool', () => {
      beforeEach(async () => {
        await wunderPool.connect(user1).enterPool({value: matic(70)});
        await wunderPool.connect(user2).enterPool({value: matic(30)});
      });

      it('User 3 can not join because the Pool is too expensive', async () => {
        await expect(wunderPool.connect(user3).enterPool({value: 0})).to.be.revertedWith("Your stake is not high enough");
        await expect(wunderPool.connect(user3).enterPool({value: matic(9)})).to.be.revertedWith("Your stake is not high enough");
      });

      describe('Use the Pool', () => {
        let wunderSwapper, sunMinerToken, abiCoder;
        beforeEach(async () => {
          abiCoder = new ethers.utils.AbiCoder();
          const WunderSwapper = await ethers.getContractFactory('WunderSwapperBeta');
          wunderSwapper = await WunderSwapper.deploy();
          sunMinerToken = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
        });

        it('Members can propose to Ape into a Token', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), matic(1), 1846183041);
          expect((await wunderPool.getAllProposalIds()).length).to.equal(1);
        });

        it('Members can vote for Proposals', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), matic(1), 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 2);
          await wunderPool.connect(user2).vote(0, 1);
          const {yesVotes, noVotes} = await wunderPool.getProposal(0);
          expect(yesVotes).to.equal(130);
          expect(noVotes).to.equal(70);
        });

        it('Proposal gets executed once Majority is reached', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), matic(1), 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          const sunMinerBalance = await sunMinerToken.balanceOf(wunderPool.address);
          expect(sunMinerBalance).to.be.gt(0);
        });

        it('Token can be added to the Pool', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), matic(1), 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          await wunderPool.addToken(sunMinerToken.address);
          expect((await wunderPool.getOwnedTokenAddresses()).length).to.equal(1);
        });

        it('Token can be added to the Pool Programatically', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [wunderSwapper.address, wunderPool.address], ["buyTokens(address)", "addToken(address)"], [abiCoder.encode(["address"], [sunMinerToken.address]), abiCoder.encode(["address"], [sunMinerToken.address])], [matic(1), 0], 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          expect((await wunderPool.getOwnedTokenAddresses()).length).to.equal(1);
        });

        it('Members can propose to Sell a Token', async () => {
          await wunderPool.createProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", wunderSwapper.address, "buyTokens(address)", abiCoder.encode(["address"], [sunMinerToken.address]), matic(1), 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          
          const currentBalance = await sunMinerToken.balanceOf(wunderPool.address);
          await wunderPool.connect(user2).createMultiActionProposal("Let's Sell SunMinerToken", "SunMinerToken Not going anywhere", [sunMinerToken.address, wunderSwapper.address], ["transfer(address,uint256)", "sellTokens(address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, currentBalance]), abiCoder.encode(["address", "uint"], [sunMinerToken.address, currentBalance])], [0, 0], 1846183041);
          await wunderPool.vote(1, 1);
          await wunderPool.connect(user2).vote(1, 1);
          await expect(wunderPool.executeProposal(1)).to.not.be.reverted;
          
          const balanceAfterSell = await sunMinerToken.balanceOf(wunderPool.address);
          expect(balanceAfterSell).to.equal(0);
        });

        describe('Liquidate the Pool', () => {
          let provider, maticPool, maticOwner, maticUser1, maticUser2, smtPool, smtOwner, smtUser1, smtUser2;
          beforeEach(async () => {
            provider = wunderPool.provider;
            await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [wunderSwapper.address, wunderPool.address], ["buyTokens(address)", "addToken(address)"], [abiCoder.encode(["address"], [sunMinerToken.address]), abiCoder.encode(["address"], [sunMinerToken.address])], [matic(10), 0], 1846183041);
            await wunderPool.vote(0, 1);
            await wunderPool.connect(user1).vote(0, 1);
            await wunderPool.connect(user3).executeProposal(0);
            await wunderPool.createProposal("Let's Liquidate the Pool", "I want my money back", wunderPool.address, "liquidatePool()", '0x', 0, 1846183041);
            await wunderPool.vote(1, 1);
            await wunderPool.connect(user1).vote(1, 1);
            
            maticPool = await provider.getBalance(wunderPool.address);
            maticOwner = await provider.getBalance(owner.address);
            maticUser1 = await provider.getBalance(user1.address);
            maticUser2 = await provider.getBalance(user2.address);

            smtPool = await sunMinerToken.balanceOf(wunderPool.address);
            smtOwner = await sunMinerToken.balanceOf(owner.address);
            smtUser1 = await sunMinerToken.balanceOf(user1.address);
            smtUser2 = await sunMinerToken.balanceOf(user2.address);
            await wunderPool.connect(user3).executeProposal(1);
          });

          it('Should distribute MATIC fairly to all members', async () => {
            expect(await provider.getBalance(owner.address)).to.equal(maticOwner.add(maticPool.mul(10).div(20)));
            expect(await provider.getBalance(user1.address)).to.equal(maticUser1.add(maticPool.mul(7).div(20)));
            expect(await provider.getBalance(user2.address)).to.equal(maticUser2.add(maticPool.mul(3).div(20)));
          });
          
          it('Should distribute Tokens fairly to all members', async () => {
            expect(await sunMinerToken.balanceOf(owner.address)).to.equal(smtOwner.add(smtPool.mul(10).div(20)));
            expect(await sunMinerToken.balanceOf(user1.address)).to.equal(smtUser1.add(smtPool.mul(7).div(20)));
            expect(await sunMinerToken.balanceOf(user2.address)).to.equal(smtUser2.add(smtPool.mul(3).div(20)));
          });

          it('Should destroy the Pool', async () => {
            await wunderPool.liquidatePool();
            await expect(wunderPool.name()).to.be.reverted;
          });
        });
      });
    
    });
  
  });
});
