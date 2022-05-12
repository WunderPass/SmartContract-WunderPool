const chai = require('chai');
const assertArrays = require('chai-arrays');
const { usdc, usdcBalance, usdcAddress, matic, topUp, approve } = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;

describe('POOL JOURNEY', () => {
  let poolLauncher, owner, user1, user2, user3;

  beforeEach(async () => {
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherGamma');
    poolLauncher = await PoolLauncher.deploy();
    [owner, user1, user2, user3, _] = await ethers.getSigners();
    await topUp(owner, usdc(200));
    await approve(owner, poolLauncher.address, usdc(200));
  });

  describe('Create New WunderPool', () => {
    
    let wunderPool, govToken;
    beforeEach(async () => {
      await poolLauncher.createNewPool("CryptoApes", usdc(10), "CryptoApesToken", "CAT", usdc(100));
      const poolAddress = (await poolLauncher.allPools())[0];
      wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
      const govTokenAddress = await wunderPool.governanceToken();
      govToken = await ethers.getContractAt("PoolGovernanceTokenGamma", govTokenAddress, owner);
    });

    it('Should launch a new WunderPool', async () => {
      expect((await poolLauncher.allPools()).length).to.equal(1);
      expect((await poolLauncher.poolsOfMember(owner.address)).length).to.equal(1);
      expect(await wunderPool.name()).to.equal("CryptoApes");
      expect(await usdcBalance(wunderPool.address)).to.equal(usdc(100));
    });

    it('Should launch a new Governance Token', async () => {
      expect(await govToken.name()).to.equal("CryptoApesToken");
      expect(await govToken.symbol()).to.equal("CAT");
      expect(await govToken.decimals()).to.equal(0);
      expect(await govToken.balanceOf(owner.address)).to.equal(100);
      expect(await govToken.launcherAddress()).to.equal(poolLauncher.address);
      expect(await govToken.poolAddress()).to.equal(wunderPool.address);
      expect(await govToken.price()).to.equal(usdc(1));
    });

    describe('Joining the Pool', () => {
      beforeEach(async () => {
        await topUp(user1, usdc(100));
        await approve(user1, wunderPool.address, usdc(70));
        await topUp(user2, usdc(100));
        await approve(user2, wunderPool.address, usdc(30));
        await wunderPool.connect(user1).joinPool(usdc(70));
        await wunderPool.connect(user2).joinPool(usdc(30));
      });

      it('User 3 can not join because the Pool is too expensive', async () => {
        await expect(wunderPool.connect(user3).joinPool(0)).to.be.revertedWith("Your stake is not high enough");
        await expect(wunderPool.connect(user3).joinPool(usdc(9))).to.be.revertedWith("Your stake is not high enough");
      });

      describe('Use the Pool', () => {
        let wunderSwapper, sunMinerToken, testNft, abiCoder;
        beforeEach(async () => {
          abiCoder = new ethers.utils.AbiCoder();
          const WunderSwapper = await ethers.getContractFactory('WunderSwapperGamma');
          wunderSwapper = await WunderSwapper.deploy();
          const TestNft = await ethers.getContractFactory('TestNft');
          testNft = await TestNft.deploy("RustyNft", "RTN", matic(1), usdc(1));
          sunMinerToken = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
        });

        it('Members can propose to Ape into a Token', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)])], [0, 0], 1846183041)
          expect((await wunderPool.getAllProposalIds()).length).to.equal(1);
        });

        it('Members can vote for Proposals', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)])], [0, 0], 1846183041)
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 2);
          await wunderPool.connect(user2).vote(0, 1);
          const {yesVotes, noVotes} = await wunderPool.getProposal(0);
          expect(yesVotes).to.equal(130);
          expect(noVotes).to.equal(70);
        });

        it('Proposal gets executed once Majority is reached', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)])], [0, 0], 1846183041)
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          const sunMinerBalance = await sunMinerToken.balanceOf(wunderPool.address);
          expect(sunMinerBalance).to.be.gt(0);
        });

        it('Token can be added to the Pool', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)])], [0, 0], 1846183041)
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          await wunderPool.addToken(sunMinerToken.address, false, 0);
          expect((await wunderPool.getOwnedTokenAddresses()).length).to.equal(2);
        });

        it('Token can be added to the Pool Programatically', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address, wunderPool.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)", "addToken(address,bool,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)]), abiCoder.encode(["address", "bool", "uint256"], [sunMinerToken.address, false, 0])], [0, 0, 0], 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          expect((await wunderPool.getOwnedTokenAddresses()).length).to.equal(2);
        });

        it('Members can buy an NFT', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into RustyNFT", "RustyNFT is the real shit!", [usdcAddress, testNft.address], ["approve(address,uint256)", "mintUsd()"], [abiCoder.encode(["address", "uint"], [testNft.address, usdc(1)]), "0x"], [0, 0], 1846183041);
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          await wunderPool.addToken(testNft.address, true, 0);
          expect((await wunderPool.getOwnedNftTokenIds(testNft.address)).length).to.equal(1);
        });

        it('Members can propose to Sell a Token', async () => {
          await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)])], [0, 0], 1846183041)
          await wunderPool.vote(0, 1);
          await wunderPool.connect(user1).vote(0, 1);
          await expect(wunderPool.executeProposal(0)).to.not.be.reverted;
          
          const currentBalance = await sunMinerToken.balanceOf(wunderPool.address);
          await wunderPool.connect(user2).createMultiActionProposal("Let's Sell SunMinerToken", "SunMinerToken Not going anywhere", [sunMinerToken.address, wunderSwapper.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, currentBalance]), abiCoder.encode(["address", "address", "uint256"], [sunMinerToken.address, usdcAddress, currentBalance])], [0, 0], 1846183041);
          await wunderPool.vote(1, 1);
          await wunderPool.connect(user2).vote(1, 1);
          await expect(wunderPool.executeProposal(1)).to.not.be.reverted;
          
          const balanceAfterSell = await sunMinerToken.balanceOf(wunderPool.address);
          expect(balanceAfterSell).to.equal(0);
        });

        describe('Liquidate the Pool', () => {
          let provider, usdcPool, usdcOwner, usdcUser1, usdcUser2, smtPool, smtOwner, smtUser1, smtUser2;
          beforeEach(async () => {
            provider = wunderPool.provider;
            await wunderPool.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [usdcAddress, wunderSwapper.address, wunderPool.address], ["transfer(address,uint256)", "swapTokens(address,address,uint256)", "addToken(address,bool,uint256)"], [abiCoder.encode(["address", "uint"], [wunderSwapper.address, usdc(1)]), abiCoder.encode(["address", "address", "uint256"], [usdcAddress, sunMinerToken.address, usdc(1)]), abiCoder.encode(["address", "bool", "uint256"], [sunMinerToken.address, false, 0])], [0, 0, 0], 1846183041);
            await wunderPool.vote(0, 1);
            await wunderPool.connect(user1).vote(0, 1);
            await wunderPool.connect(user3).executeProposal(0);
            await wunderPool.createMultiActionProposal("Let's Ape into RustyNFT", "RustyNFT is the real shit!", [usdcAddress, testNft.address], ["approve(address,uint256)", "mintUsd()"], [abiCoder.encode(["address", "uint"], [testNft.address, usdc(1)]), "0x"], [0, 0], 1846183041);
            await wunderPool.vote(1, 1);
            await wunderPool.connect(user1).vote(1, 1);
            await wunderPool.connect(user3).executeProposal(1);
            await wunderPool.addToken(testNft.address, true, 0);
            await wunderPool.createProposal("Let's Liquidate the Pool", "I want my money back", wunderPool.address, "liquidatePool()", '0x', 0, 1846183041);
            await wunderPool.vote(2, 1);
            await wunderPool.connect(user1).vote(2, 1);
            
            usdcPool = await usdcBalance(wunderPool.address);
            usdcOwner = await usdcBalance(owner.address);
            usdcUser1 = await usdcBalance(user1.address);
            usdcUser2 = await usdcBalance(user2.address);

            smtPool = await sunMinerToken.balanceOf(wunderPool.address);
            smtOwner = await sunMinerToken.balanceOf(owner.address);
            smtUser1 = await sunMinerToken.balanceOf(user1.address);
            smtUser2 = await sunMinerToken.balanceOf(user2.address);
            await wunderPool.connect(user3).executeProposal(2);
          });

          it('Should distribute USDC fairly to all members', async () => {
            expect(await usdcBalance(owner.address)).to.equal(usdcOwner.add(usdcPool.mul(10).div(20)));
            expect(await usdcBalance(user1.address)).to.equal(usdcUser1.add(usdcPool.mul(7).div(20)));
            expect(await usdcBalance(user2.address)).to.equal(usdcUser2.add(usdcPool.mul(3).div(20)));
          });
          
          it('Should distribute Tokens fairly to all members', async () => {
            expect(await sunMinerToken.balanceOf(owner.address)).to.equal(smtOwner.add(smtPool.mul(10).div(20)));
            expect(await sunMinerToken.balanceOf(user1.address)).to.equal(smtUser1.add(smtPool.mul(7).div(20)));
            expect(await sunMinerToken.balanceOf(user2.address)).to.equal(smtUser2.add(smtPool.mul(3).div(20)));
          });

          it('Should distribute NFTs randomly to all members', async () => {
            const ownerNfts = await testNft.balanceOf(owner.address);
            const user1Nfts = await testNft.balanceOf(user1.address);
            const user2Nfts = await testNft.balanceOf(user2.address);
            expect(ownerNfts.toNumber() + user1Nfts.toNumber() + user2Nfts.toNumber()).to.equal(1);
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
