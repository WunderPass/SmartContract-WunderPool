const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

describe('FEE MODEL', () => {
  let deployer, treasury, poolConfig;
  beforeEach(async () => {
    [deployer, treasury] = await ethers.getSigners();
    const PoolConfig = await ethers.getContractFactory('PoolConfigZeta');
    poolConfig = await PoolConfig.deploy(treasury.address, 30);
  });

  it('Treasury Wallet can update the treasury', async () => {
    expect(await poolConfig.treasury()).to.be.equal(treasury.address);
    await poolConfig.connect(treasury).changeTreasury(deployer.address);
    expect(await poolConfig.treasury()).to.be.equal(deployer.address);
  });

  it('Treasury Wallet can update the Fee', async () => {
    expect(await poolConfig.feePerMille()).to.be.equal(30);
    await poolConfig.connect(treasury).changeFee(20);
    expect(await poolConfig.feePerMille()).to.be.equal(20);
  });
});
