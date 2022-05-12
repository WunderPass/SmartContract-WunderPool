const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('POOL LAUNCHER CONTRACT', () => {
  let contract, owner, user1, user2;

  beforeEach(async () => {
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherBeta');
    contract = await PoolLauncher.deploy();
    [owner, user1, user2, _] = await ethers.getSigners();
  });

  describe('Create New WunderPool', () => {
    it('Should deploy a new WunderPool', async () => {
      await contract.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", {value: matic(100)});
      expect((await contract.allPools()).length).to.equal(1);
      expect((await contract.poolsOfMember(owner.address)).length).to.equal(1);
    });

    it('Deployed Contract should be a WunderPool', async () => {
      await contract.createNewPool("OwnersPool", 0, "OwnerPoolTokens", "OPT", {value: matic(100)});
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
      expect(await wunderPool.name()).to.equal("OwnersPool");
    });

    it('WunderPool Should be configured correctly', async () => {
      await contract.createNewPool("OwnersPool", matic(50), "OwnerPoolTokens", "OPT", {value: matic(100)});
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
      expect(await wunderPool.entryBarrier()).to.equal(matic(50));
      expect(await wunderPool.launcherAddress()).to.equal(contract.address);
    });

    it('Should emit the PoolLaunched Event', async () => {
      const tx = await contract.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", {value: matic(100)});
      const poolAddress = (await contract.allPools())[0];
      await expect(tx).to.emit(contract, 'PoolLaunched').withArgs(owner.address, poolAddress, "CryptoApes", "CryptoApesToken");
    });

    it('Should track and output the pools of a creator', async () => {
      await contract.createNewPool("OwnersPool", 0, "OwnerPoolTokens", "OPT", {value: matic(100)});
      await contract.connect(user1).createNewPool("Pool of User1", 0, "PoolTokens", "PT", {value: matic(0)});
      await contract.connect(user1).createNewPool("Second Pool of User1", 0, "PoolTokens", "PT", {value: matic(0)});
      await contract.connect(user2).createNewPool("Pool of User2", 0, "PoolTokens", "PT", {value: matic(0)});

      expect((await contract.poolsOfMember(owner.address)).length).to.equal(1);
      expect((await contract.poolsOfMember(user1.address)).length).to.equal(2);
      expect((await contract.poolsOfMember(user2.address)).length).to.equal(1);

      const poolAddress = (await contract.allPools())[0];
      ownerPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
      await ownerPool.connect(user1).enterPool({value: matic(5)});
      expect((await contract.poolsOfMember(user1.address)).length).to.equal(3);
    });
  });

  describe('Create New Governance Token', () => {
    let govToken, wunderPool;
    beforeEach(async () => {
      await contract.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", {value: matic(100)});
      const poolAddress = (await contract.allPools())[0];
      wunderPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
      const govTokenAddress = await wunderPool.governanceToken();
      govToken = await ethers.getContractAt("PoolGovernanceTokenBeta", govTokenAddress, owner);
    })

    it('Should deploy a new Governance Token', async () => {
      expect(await govToken.name()).to.equal("CryptoApesToken");
      expect(await govToken.symbol()).to.equal("CAT");
      expect(await govToken.price()).to.equal(matic(1));
      expect(await govToken.balanceOf(owner.address)).to.equal(100);
    });

    it('Should set the launcher and pool Address in the Governance Token', async () => {
      expect(await govToken.poolAddress()).to.equal(wunderPool.address);
      expect(await govToken.launcherAddress()).to.equal(contract.address);
    });
  });
});
