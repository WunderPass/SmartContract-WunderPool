const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

describe('POOL LAUNCHER CONTRACT', () => {
  let PoolLauncher, contract, owner, user1, user2;

  beforeEach(async () => {
    PoolLauncher = await ethers.getContractFactory('PoolLauncher');
    contract = await PoolLauncher.deploy();
    [owner, user1, user2, _] = await ethers.getSigners();
  });

  describe('Create New WunderPool', () => {
    it('Should deploy a new WunderPool', async () => {
      await contract.createNewPool("CryptoApes");
      expect((await contract.allPools()).length).to.equal(1);
      expect((await contract.poolsOfMember(owner.address)).length).to.equal(1);
    });

    it('Deployed Contract should be a WunderPool', async () => {
      await contract.createNewPool("Owners Pool");
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPool", poolAddress, owner);
      expect(await wunderPool.poolName()).to.equal("Owners Pool");
    });

    it('Creator should be the Admin of the Pool', async () => {
      await contract.createNewPool("Owners Pool");
      const poolAddress = (await contract.allPools())[0];
      const wunderPool = await ethers.getContractAt("WunderPool", poolAddress, owner);
      await wunderPool.addMember(user1.address);
      expect((await wunderPool.poolMembers()).length).to.equal(2)
    });

    it('Should emit the PoolLaunched Event', async () => {
      const tx = await contract.createNewPool("CryptoApes");
      const poolAddress = (await contract.allPools())[0];
      await expect(tx).to.emit(contract, 'PoolLaunched').withArgs(owner.address, poolAddress, "CryptoApes");
    });

    it('Should track and output the pools of a creator', async () => {
      await contract.createNewPool("Owners Pool");
      await contract.connect(user1).createNewPool("Pool of User1");
      await contract.connect(user1).createNewPool("Second Pool of User1");
      await contract.connect(user2).createNewPool("Pool of User2");

      expect((await contract.poolsOfMember(owner.address)).length).to.equal(1);
      expect((await contract.poolsOfMember(user1.address)).length).to.equal(2);
      expect((await contract.poolsOfMember(user2.address)).length).to.equal(1);
    });
  });
});
