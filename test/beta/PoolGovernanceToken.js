const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const matic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('POOL GOVERNANCE TOKEN', () => {
  let poolLauncher, wunderPool, govToken, owner, user1, user2, user3;

  beforeEach(async () => {
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherBeta');
    poolLauncher = await PoolLauncher.deploy();
    [owner, user1, user2, user3, _] = await ethers.getSigners();
    await poolLauncher.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", {value: matic(100)});
    const poolAddress = (await poolLauncher.allPools())[0];
    wunderPool = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
    const govTokenAddress = await wunderPool.governanceToken();
    govToken = await ethers.getContractAt("PoolGovernanceTokenBeta", govTokenAddress, owner);
  });

  describe('Create New Governance Token', () => {
    it('Should have the correct Name, Symbol and Decimals', async () => {
      expect(await govToken.name()).to.equal("CryptoApesToken");
      expect(await govToken.symbol()).to.equal("CAT");
      expect(await govToken.decimals()).to.equal(0);
    });

    it('Should mint 100 Tokens to the pool creator and set the correct price', async () => {
      expect(await govToken.balanceOf(owner.address)).to.equal(100);
      expect(await govToken.price()).to.equal(matic(1));
    });

    it('Should set the correct pool and launcher addresses', async () => {
      expect(await govToken.launcherAddress()).to.equal(poolLauncher.address);
      expect(await govToken.poolAddress()).to.equal(wunderPool.address);
    });
  });

  describe('Locked Functions', () => {
    it('Only the Launcher can set the Pool Address', async () => {
      await expect(govToken.setPoolAddress(user1.address)).to.be.revertedWith("Only the Launcher can set the PoolAddress");
    });

    it('Only the Pool can issue Tokens', async () => {
      await expect(govToken.issue(user1.address, 100)).to.be.revertedWith("Only the Pool can issue new tokens");
    });

    it('Only the Pool can destroy the Contract', async () => {
      await expect(govToken.destroy()).to.be.revertedWith("Only the Pool can destroy this contract");
    });
  });
});
