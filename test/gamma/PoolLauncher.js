const chai = require('chai');
const assertArrays = require('chai-arrays');
const { usdc, matic, topUp, approve } = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;

describe('POOL LAUNCHER CONTRACT', () => {
  let contract, owner, user1, user2;

  beforeEach(async () => {
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherGamma');
    contract = await PoolLauncher.deploy();
    [owner, user1, user2, _] = await ethers.getSigners();
    await topUp(owner, usdc(200));
    await approve(owner, contract.address, usdc(100));
  });

  describe('Create New WunderPool', () => {
    it('Should deploy a new WunderPool', async () => {
      await contract.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", usdc(100));
      expect((await contract.allPools()).length).to.equal(1);
      expect((await contract.poolsOfMember(owner.address)).length).to.equal(1);
    });

    it('Deployed Contract should be a WunderPool', async () => {
      await contract.createNewPool("OwnersPool", 0, "OwnerPoolTokens", "OPT", usdc(100));
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
      expect(await wunderPool.name()).to.equal("OwnersPool");
    });

    it('WunderPool Should be configured correctly', async () => {
      await contract.createNewPool("OwnersPool", usdc(50), "OwnerPoolTokens", "OPT", usdc(100));
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
      expect(await wunderPool.entryBarrier()).to.equal(usdc(50));
      expect(await wunderPool.launcherAddress()).to.equal(contract.address);
    });

    it('Should emit the PoolLaunched Event', async () => {
      const tx = await contract.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", usdc(100));
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
      const govToken = await wunderPool.governanceToken()
      await expect(tx).to.emit(contract, 'PoolLaunched').withArgs(owner.address, poolAddress, "CryptoApes", govToken, "CryptoApesToken", 0);
    });

    it('Should track and output the pools of a creator', async () => {
      await contract.createNewPool("OwnersPool", 0, "OwnerPoolTokens", "OPT", usdc(100));
      await contract.connect(user1).createNewPool("Pool of User1", 0, "PoolTokens", "PT", usdc(0));
      await contract.connect(user1).createNewPool("Second Pool of User1", 0, "PoolTokens", "PT", usdc(0));
      await contract.connect(user2).createNewPool("Pool of User2", 0, "PoolTokens", "PT", usdc(0));

      expect((await contract.poolsOfMember(owner.address)).length).to.equal(1);
      expect((await contract.poolsOfMember(user1.address)).length).to.equal(2);
      expect((await contract.poolsOfMember(user2.address)).length).to.equal(1);

      const poolAddress = (await contract.allPools())[0];
      ownerPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
      await topUp(user1, usdc(10));
      await approve(user1, ownerPool.address, usdc(5));
      await ownerPool.connect(user1).joinPool(usdc(5));
      expect((await contract.poolsOfMember(user1.address)).length).to.equal(3);
    });
  });

  describe('Create New Governance Token', () => {
    let govToken, wunderPool;
    beforeEach(async () => {
      await contract.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", usdc(100));
      const poolAddress = (await contract.allPools())[0];
      wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
      const govTokenAddress = await wunderPool.governanceToken();
      govToken = await ethers.getContractAt("PoolGovernanceTokenGamma", govTokenAddress, owner);
    })

    it('Should deploy a new Governance Token', async () => {
      expect(await govToken.name()).to.equal("CryptoApesToken");
      expect(await govToken.symbol()).to.equal("CAT");
      expect(await govToken.price()).to.equal(usdc(1));
      expect(await govToken.balanceOf(owner.address)).to.equal(100);
    });

    it('Should set the launcher and pool Address in the Governance Token', async () => {
      expect(await govToken.poolAddress()).to.equal(wunderPool.address);
      expect(await govToken.launcherAddress()).to.equal(contract.address);
    });
  });

  describe('Pools should be upgradable', () => {
    // let betaLauncher, betaPool;

    // beforeEach(async () => {
    //   const PoolLauncher = await ethers.getContractFactory('PoolLauncherBeta');
    //   betaLauncher = await PoolLauncher.deploy();
    //   await betaLauncher.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", {value: matic(100)});
    //   const poolAddress = (await betaLauncher.allPools())[0];
    //   betaPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
    // })

    // it('Should create a new WunderPool', async () => {
    //   await contract.upgradePool(betaPool.address);
    //   expect((await contract.allPools()).length).to.equal(1);
    //   const poolAddress = (await contract.allPools())[0];
    //   const wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
    //   expect(await wunderPool.name()).to.equal("CryptoApes");
    // });

    // it('Should issue the correct number of governance tokens', async () => {
    //   await betaPool.connect(user1).enterPool({value: matic(70)});
    //   await betaPool.connect(user2).enterPool({value: matic(30)});
    //   await contract.upgradePool(betaPool.address);
      
    //   const poolAddress = (await contract.allPools())[0];
    //   const wunderPool = await ethers.getContractAt("WunderPoolGamma", poolAddress, owner);
    //   const govTokenAddress = await wunderPool.governanceToken();
    //   govToken = await ethers.getContractAt("PoolGovernanceTokenGamma", govTokenAddress, owner);
      
    //   expect(await govToken.name()).to.equal("CryptoApesToken");
    //   expect(await govToken.symbol()).to.equal("CAT");
    //   expect(await govToken.price()).to.equal(usdc(1));
    //   expect(await govToken.balanceOf(owner.address)).to.equal(100);
    //   expect(await govToken.balanceOf(user1.address)).to.equal(70);
    //   expect(await govToken.balanceOf(user2.address)).to.equal(30);
    // });

    // it('Should transfer all ERC20 and ERC721 Tokens', async () => {
    //   // multi step proposal 
    //   // 1. Approve all assets
    //   // 2. Call upgrade
    //   // Implement in Launcher: 
    //   // for (oldPool.ownedTokens.length) {
    //   //   token.transfer(newPool, balance)
    //   // }
    //   throw 'Not Implemented Yet'
    // });

    // it('Should emit the PoolUpgraded Event', async () => {
    //   const tx = await contract.upgradePool(betaPool.address);
    //   const poolAddress = (await contract.allPools())[0];
    //   await expect(tx).to.emit(contract, 'PoolUpgraded').withArgs(betaPool.address, poolAddress);
    // });
  });
});
