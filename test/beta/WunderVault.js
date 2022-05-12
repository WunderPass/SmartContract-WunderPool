const chai = require('chai');
const assertArrays = require('chai-arrays');
chai.use(assertArrays);
const expect = chai.expect;
const nullAddress = "0x0000000000000000000000000000000000000000";

const matic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

describe('WUNDER VAULT CONTRACT', () => {
  let wunderVault, abiCoder, provider, owner, user1, user2, user3;
  beforeEach(async () => {
    [owner, user1, user2, user3, _] = await ethers.getSigners();
    abiCoder = new ethers.utils.AbiCoder();
    
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherBeta');
    const poolLauncher = await PoolLauncher.deploy();
    await poolLauncher.createNewPool("CryptoApes", 0, "CryptoApesToken", "CAT", {value: matic(10)});
    const poolAddress = (await poolLauncher.allPools())[0];
    wunderVault = await ethers.getContractAt("WunderPoolBeta", poolAddress, owner);
    provider = wunderVault.provider;
  });

  describe('Add New Token', () => {
    let tokenContract;
    beforeEach(async () => {
      const TestToken = await ethers.getContractFactory('TestToken');
      tokenContract = await TestToken.deploy("RustyTromboneCoin", "RTC");
    });

    it('Should revert if token is not ERC20', async () => {
      await expect(wunderVault.addToken(nullAddress)).to.be.revertedWith("Not a valid ERC20 Token");
    });

    it('Should revert if Vault does not own the token', async () => {
      await expect(wunderVault.addToken(tokenContract.address)).to.be.revertedWith("Token will not be added: Token not owned by contract");
    });

    it('Should add a new valid token to the vault', async () => {
      await tokenContract.transfer(wunderVault.address, 50)
      await wunderVault.addToken(tokenContract.address);
      expect((await wunderVault.getOwnedTokenAddresses()).length).to.equal(1);
    });

    it('Should emit the TokenAdded Event', async () => {
      await tokenContract.transfer(wunderVault.address, 50)
      await expect(wunderVault.addToken(tokenContract.address)).to.emit(wunderVault, 'TokenAdded').withArgs(tokenContract.address, 50);
    });
  });

  describe('MATIC Withdrawel', () => {
    it('Should not be possible to withdraw MATIC', async () => {
      await expect(wunderVault._withdrawMatic(owner.address, matic(1))).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
      await expect(wunderVault._distributeMaticEvenly([owner.address], matic(1))).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
      await expect(wunderVault._distributeAllMaticEvenly([owner.address])).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
    });

    it('Should be possible to withdraw MATIC with a Proposal', async () => {
      await wunderVault.createProposal("Let's Withdraw Some MATIC", "FUD!", wunderVault.address, "_withdrawMatic(address,uint256)", abiCoder.encode(["address", "uint256"], [owner.address, matic(1)]), 0, 1846183041);
      await wunderVault.createProposal("Let's Withdraw Some MATIC Evenly", "FUD!", wunderVault.address, "_distributeMaticEvenly(address[],uint256)", abiCoder.encode(["address[]", "uint256"], [[owner.address], matic(1)]), 0, 1846183041);
      await wunderVault.createProposal("Let's Withdraw ALL MATIC Evenly", "FUD!", wunderVault.address, "_distributeAllMaticEvenly(address[])", abiCoder.encode(["address[]"], [[owner.address]]), 0, 1846183041);
      
      let oldBalance = await provider.getBalance(owner.address);
      let newBalance;

      await wunderVault.vote(0, 1);
      await wunderVault.executeProposal(0);
      newBalance = await provider.getBalance(owner.address);
      expect(newBalance).to.be.gt(oldBalance);
      oldBalance = newBalance;
      
      await wunderVault.vote(1, 1);
      await wunderVault.executeProposal(1);
      newBalance = await provider.getBalance(owner.address);
      expect(newBalance).to.be.gt(oldBalance);
      oldBalance = newBalance;

      await wunderVault.vote(2, 1);
      await wunderVault.executeProposal(2);
      newBalance = await provider.getBalance(owner.address);
      expect(newBalance).to.be.gt(oldBalance);
    });

    it('Should distribute MATIC Fairly based on Governance Tokens', async () => {
      await wunderVault.connect(user1).enterPool({value: matic(5)});
      await wunderVault.connect(user2).enterPool({value: matic(7)});

      await wunderVault.createProposal("Let's Withdraw ALL MATIC Evenly", "FUD!", wunderVault.address, "_distributeAllMaticEvenly(address[])", abiCoder.encode(["address[]"], [[owner.address, user1.address, user2.address]]), 0, 1846183041);
      await wunderVault.vote(0, 1);
      await wunderVault.connect(user1).vote(0, 1);
      const ownerBalance = await provider.getBalance(owner.address);
      const user1Balance = await provider.getBalance(user1.address);
      const user2Balance = await provider.getBalance(user2.address);
      await wunderVault.connect(user3).executeProposal(0);

      expect(await provider.getBalance(owner.address)).to.equal(ownerBalance.add(matic(10)));
      expect(await provider.getBalance(user1.address)).to.equal(user1Balance.add(matic(5)));
      expect(await provider.getBalance(user2.address)).to.equal(user2Balance.add(matic(7)));
    })
  });

  describe('Token Withdrawel', () => {
    let tokenContract, tokenBalance;
    beforeEach(async () => {
      tokenContract = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
      const WunderSwapper = await ethers.getContractFactory('WunderSwapperBeta');
      const wunderSwapper = await WunderSwapper.deploy();
      await wunderVault.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [wunderSwapper.address, wunderVault.address], ["buyTokens(address)", "addToken(address)"], [abiCoder.encode(["address"], [tokenContract.address]), abiCoder.encode(["address"], [tokenContract.address])], [matic(1), 0], 1846183041);
      await wunderVault.vote(0, 1);
      await wunderVault.executeProposal(0);
      tokenBalance = await tokenContract.balanceOf(wunderVault.address);
    });

    it('Should not be possible to withdraw Tokens', async () => {
      expect(await tokenContract.balanceOf(wunderVault.address)).to.be.gt(0);
      await expect(wunderVault._withdrawTokens(tokenContract.address, owner.address, 1)).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
      await expect(wunderVault._distributeSomeBalanceOfTokenEvenly(tokenContract.address, [owner.address], 1)).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
      await expect(wunderVault._distributeFullBalanceOfTokenEvenly(tokenContract.address, [owner.address])).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
      await expect(wunderVault._distributeFullBalanceOfAllTokensEvenly([owner.address])).to.be.revertedWith("Only the Pool is allowed to execute this function. Try submitting a proposal");
    });

    it('Should be possible to withdraw Tokens with a Proposal', async () => {
      await wunderVault.createProposal("Let's Withdraw Some SMT", "FUD!", wunderVault.address, "_withdrawTokens(address,address,uint256)", abiCoder.encode(["address", "address", "uint256"], [tokenContract.address, owner.address, tokenBalance.div(3)]), 0, 1846183041);
      await wunderVault.createProposal("Let's Withdraw Some SMT Evenly", "FUD!", wunderVault.address, "_distributeSomeBalanceOfTokenEvenly(address,address[],uint256)", abiCoder.encode(["address", "address[]", "uint256"], [tokenContract.address, [owner.address], tokenBalance.div(3)]), 0, 1846183041);
      await wunderVault.createProposal("Let's Withdraw ALL SMT Evenly", "FUD!", wunderVault.address, "_distributeFullBalanceOfAllTokensEvenly(address[])", abiCoder.encode(["address[]"], [[owner.address]]), 0, 1846183041);
      
      await wunderVault.vote(1, 1);
      await wunderVault.executeProposal(1);
      expect(await tokenContract.balanceOf(owner.address)).to.equal(tokenBalance.div(3));
      
      await wunderVault.vote(2, 1);
      await wunderVault.executeProposal(2);
      expect(await tokenContract.balanceOf(owner.address)).to.equal(tokenBalance.div(3).mul(2));

      await wunderVault.vote(3, 1);
      await wunderVault.executeProposal(3);
      expect(await tokenContract.balanceOf(owner.address)).to.equal(tokenBalance);
    });

    it('Should distribute Tokens Fairly based on Governance Tokens', async () => {
      await wunderVault.connect(user1).enterPool({value: matic(5)});
      await wunderVault.connect(user2).enterPool({value: matic(7)});
      
      await wunderVault.createProposal("Let's Withdraw ALL SMT Evenly", "FUD!", wunderVault.address, "_distributeFullBalanceOfAllTokensEvenly(address[])", abiCoder.encode(["address[]"], [[owner.address, user1.address, user2.address]]), 0, 1846183041);
      await wunderVault.vote(1, 1);
      await wunderVault.connect(user1).vote(1, 1);
      
      const ownerBalance = await tokenContract.balanceOf(owner.address)
      const user1Balance = await tokenContract.balanceOf(user1.address)
      const user2Balance = await tokenContract.balanceOf(user2.address)
      await wunderVault.executeProposal(1);

      expect(await tokenContract.balanceOf(owner.address)).to.equal(ownerBalance.add(tokenBalance.mul(10).div(22)));
      expect(await tokenContract.balanceOf(user1.address)).to.equal(user1Balance.add(tokenBalance.mul(5).div(22)));
      expect(await tokenContract.balanceOf(user2.address)).to.equal(user2Balance.add(tokenBalance.mul(7).div(22)));
    })
  });

  describe('Governance Token Functions', () => {
    it('Should return the Governance Token Balance of an address', async () => {
      await wunderVault.connect(user1).enterPool({value: matic(5)});
      await wunderVault.connect(user2).enterPool({value: matic(7)});
      await wunderVault.connect(user3).enterPool({value: matic(1)});
      
      expect(await wunderVault.governanceTokensOf(owner.address)).to.equal(100);
      expect(await wunderVault.governanceTokensOf(user1.address)).to.equal(50);
      expect(await wunderVault.governanceTokensOf(user2.address)).to.equal(70);
      expect(await wunderVault.governanceTokensOf(user3.address)).to.equal(10);
      
      await user3.sendTransaction({to: wunderVault.address, value: matic(1)})
      expect(await wunderVault.governanceTokensOf(user3.address)).to.equal(20);
    });

    it('Should return the total Amount of Governance Tokens', async () => {
      await wunderVault.connect(user1).enterPool({value: matic(5)});
      await wunderVault.connect(user2).enterPool({value: matic(7)});
      await wunderVault.connect(user3).enterPool({value: matic(1)});
      
      expect(await wunderVault.totalGovernanceTokens()).to.equal(230);
      
      await user3.sendTransaction({to: wunderVault.address, value: matic(1)})
      expect(await wunderVault.totalGovernanceTokens()).to.equal(240);
    });

    it('Should return the Governance Token Price', async () => {
      expect(await wunderVault.governanceTokenPrice()).to.equal(matic(0.1));
    });
  });

  describe('Distribute after liquidation', () => {
    let tokenContract, govToken, maticPool, maticOwner, maticUser1, maticUser2, smtPool, smtOwner, smtUser1, smtUser2;
    beforeEach(async () => {
      const govTokenAddress = await wunderVault.governanceToken();
      govToken = await ethers.getContractAt("PoolGovernanceTokenBeta", govTokenAddress, owner);
      tokenContract = await ethers.getContractAt("TestToken", '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c', owner);
      const WunderSwapper = await ethers.getContractFactory('WunderSwapperBeta');
      const wunderSwapper = await WunderSwapper.deploy();
      await wunderVault.createMultiActionProposal("Let's Ape into SunMinerToken", "SunMinerToken is the real shit!", [wunderSwapper.address, wunderVault.address], ["buyTokens(address)", "addToken(address)"], [abiCoder.encode(["address"], [tokenContract.address]), abiCoder.encode(["address"], [tokenContract.address])], [matic(1), 0], 1846183041);
      await wunderVault.vote(0, 1);
      await wunderVault.executeProposal(0);
      await wunderVault.connect(user1).enterPool({value: matic(5)});
      await wunderVault.connect(user2).enterPool({value: matic(7)});
      await wunderVault.createProposal("Let's Liquidate the Pool", "I want my money back", wunderVault.address, "liquidatePool()", '0x', 0, 1846183041);
      await wunderVault.vote(1, 1);
      await wunderVault.connect(user1).vote(1, 1);

      maticPool = await provider.getBalance(wunderVault.address);
      maticOwner = await provider.getBalance(owner.address);
      maticUser1 = await provider.getBalance(user1.address);
      maticUser2 = await provider.getBalance(user2.address);

      smtPool = await tokenContract.balanceOf(wunderVault.address);
      smtOwner = await tokenContract.balanceOf(owner.address);
      smtUser1 = await tokenContract.balanceOf(user1.address);
      smtUser2 = await tokenContract.balanceOf(user2.address);

      await wunderVault.connect(user3).executeProposal(1);
    });

    it('Should distribute all MATIC and Tokens Fairly', async () => {
      expect(await provider.getBalance(owner.address)).to.equal(maticOwner.add(maticPool.mul(10).div(22)));
      expect(await provider.getBalance(user1.address)).to.equal(maticUser1.add(maticPool.mul(5).div(22)));
      expect(await provider.getBalance(user2.address)).to.equal(maticUser2.add(maticPool.mul(7).div(22)));

      expect(await tokenContract.balanceOf(owner.address)).to.equal(smtOwner.add(smtPool.mul(10).div(22)));
      expect(await tokenContract.balanceOf(user1.address)).to.equal(smtUser1.add(smtPool.mul(5).div(22)));
      expect(await tokenContract.balanceOf(user2.address)).to.equal(smtUser2.add(smtPool.mul(7).div(22)));
    });

    it('Should destroy the Token Contract', async () => {
      await expect(govToken.name()).to.be.reverted;
    });
  });
});