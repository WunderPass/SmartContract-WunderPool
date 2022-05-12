const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;

const nullAddress = "0x0000000000000000000000000000000000000000";

describe('WUNDER VAULT CONTRACT', () => {
  let WunderVault, contract, TestToken, tokenContract, owner, user1, user2;

  beforeEach(async () => {
    WunderVault = await ethers.getContractFactory('WunderVault');
    contract = await WunderVault.deploy();
    TestToken = await ethers.getContractFactory('TestToken');
    tokenContract = await TestToken.deploy("RustyTromboneCoin", "RTC");
    [owner, user1, user2, _] = await ethers.getSigners();
  });

  describe('Add New Token', () => {
    it('Should revert if token is not ERC20', async () => {
      await expect(contract.addToken(nullAddress)).to.be.revertedWith("Not a valid ERC20 Token: Token has no name() function");
    });

    it('Should revert if Vault does not own the token', async () => {
      await expect(contract.addToken(tokenContract.address)).to.be.revertedWith("Token will not be added: Token not owned by contract");
    });

    it('Should add a new valid token to the vault', async () => {
      await tokenContract.transfer(contract.address, 50)
      await contract.addToken(tokenContract.address);
      expect((await contract.getOwnedTokenAddresses()).length).to.equal(1);
    });

    it('Should emit the TokenAdded Event', async () => {
      await tokenContract.transfer(contract.address, 50)
      await expect(contract.addToken(tokenContract.address)).to.emit(contract, 'TokenAdded').withArgs(tokenContract.address, 50);
    });
  });
});
