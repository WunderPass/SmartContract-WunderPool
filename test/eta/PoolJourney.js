const chai = require('chai');
const assertArrays = require('chai-arrays');
const {
  addToWhiteList,
  joinPool,
  createProposal,
  voteForUser,
  createSwapProposal,
  createJoinProposal,
  createPool,
  addToWhiteListSecret,
  delegateVotes,
  revokeVotes,
} = require('../backend');
const { deploySwapper } = require('../deployHelpers');
const {
  usdc,
  date,
  usdcBalance,
  usdcAddress,
  matic,
  topUp,
  approve,
  signMessage,
} = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;
const gnosis = true;

describe('POOL JOURNEY', () => {
  let poolConfig,
    wunderProp,
    poolLauncher,
    moritz,
    gerwin,
    slava,
    despot,
    max,
    bob,
    backend,
    treasury;
  beforeEach(async () => {
    [moritz, gerwin, slava, despot, max, bob, backend, treasury] =
      await ethers.getSigners();
    const GovernanceTokenLauncher = await ethers.getContractFactory(
      'GovernanceTokenLauncherEta'
    );
    const governanceTokenLauncher = await GovernanceTokenLauncher.deploy([]);
    const PoolConfig = await ethers.getContractFactory('PoolConfigEta');
    poolConfig = await PoolConfig.deploy(treasury.address, 30);
    const WunderProp = await ethers.getContractFactory('WunderProposalEta');
    wunderProp = await WunderProp.deploy(poolConfig.address);
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherEta');
    poolLauncher = await PoolLauncher.deploy(
      wunderProp.address,
      poolConfig.address,
      governanceTokenLauncher.address
    );
  });

  describe('Moritz creates a public Pool', () => {
    let pool, governanceToken;
    beforeEach(async () => {
      await createPool(poolLauncher, moritz, {
        maxMembers: 2,
        public: true,
      });
      const poolAddress = (await poolLauncher.allPools())[0];
      pool = await ethers.getContractAt('WunderPoolEta', poolAddress, moritz);
      const governanceTokenAddress = await pool.governanceToken();
      governanceToken = await ethers.getContractAt(
        'PoolGovernanceTokenEta',
        governanceTokenAddress,
        moritz
      );
    });

    it('Everyone can join the Pool', async () => {
      await expect(joinPool(backend, gerwin, pool, 10)).to.not.be.reverted;
      await expect(joinPool(backend, slava, pool, 10)).to.be.revertedWith(
        '202: Member Limit reached'
      );
      expect(await pool.poolMembers()).to.be.containingAllOf([
        gerwin.address,
        moritz.address,
      ]);
      expect(await governanceToken.balanceOf(moritz.address)).to.equal(
        await governanceToken.balanceOf(gerwin.address)
      );
    });
  });

  describe('Moritz creates a liquidatable Pool', () => {
    let pool;
    beforeEach(async () => {
      await createPool(poolLauncher, moritz, {
        autoLiquidate: date() + 3,
      });
      const poolAddress = (await poolLauncher.allPools())[0];
      pool = await ethers.getContractAt('WunderPoolEta', poolAddress, moritz);
    });

    it('Cant be liquidated before the endDate', async () => {
      await expect(pool.liquidatePool()).to.be.revertedWith(
        '111: Cannot be liquidated'
      );
    });

    it('Can be liquidated after the endDate', async () => {
      setTimeout(async () => {
        await expect(pool.liquidatePool()).to.not.be.reverted;
        await expect(pool.name()).to.be.reverted;
      }, 3000);
    });
  });

  describe('Moritz creates a new Pool', () => {
    let pool, governanceToken, abiCoder, treasuryBalance;
    beforeEach(async () => {
      treasuryBalance = await usdcBalance(treasury.address);
      abiCoder = new ethers.utils.AbiCoder();
      await createPool(poolLauncher, moritz, {
        members: [gerwin.address, slava.address],
        maxMembers: 4,
        votingPercent: 74,
      });
      const poolAddress = (await poolLauncher.allPools())[0];
      pool = await ethers.getContractAt('WunderPoolEta', poolAddress, moritz);
      const governanceTokenAddress = await pool.governanceToken();
      governanceToken = await ethers.getContractAt(
        'PoolGovernanceTokenEta',
        governanceTokenAddress,
        moritz
      );
    });

    it('Should launch a new WunderPool with one Member', async () => {
      expect((await poolLauncher.allPools()).length).to.equal(1);
      expect(
        (await poolLauncher.poolsOfMember(moritz.address)).length
      ).to.equal(1);
      expect(await pool.name()).to.equal('Dorsch Pool');
      expect(await pool.isMember(moritz.address)).to.equal(true);
    });

    it('Should launch a new Governance Token', async () => {
      expect(await governanceToken.name()).to.equal('Dorsch Pool Token');
      expect(await governanceToken.symbol()).to.equal('DPT');
      expect(await governanceToken.decimals()).to.equal(6);
      expect(await governanceToken.balanceOf(moritz.address)).to.equal(
        usdc(10)
      );
      expect(await governanceToken.launcherAddress()).to.equal(
        poolLauncher.address
      );
      expect(await governanceToken.poolAddress()).to.equal(pool.address);
    });

    it('Should transfer 97% of the USDC from Moritz to the Pool', async () => {
      expect(await usdcBalance(pool.address)).to.equal(usdc(9.7));
    });

    it('Should transfer a 3% Fee to the Treasury', async () => {
      expect(await usdcBalance(treasury.address)).to.equal(
        treasuryBalance.add(usdc(0.3))
      );
    });

    describe('The Pool is correctly configuered', () => {
      it('Should have two whitelisted Members', async () => {
        expect(await pool.isWhiteListed(gerwin.address)).to.equal(true);
        expect(await pool.isWhiteListed(slava.address)).to.equal(true);
        expect(await pool.isWhiteListed(despot.address)).to.equal(false);
        expect(await pool.poolWhitelist()).to.be.containingAllOf([
          gerwin.address,
          slava.address,
        ]);
      });

      it('Should set the correct min & max Invest', async () => {
        expect(await poolConfig.minInvest(pool.address)).to.equal(usdc(10));
        expect(await poolConfig.maxInvest(pool.address)).to.equal(usdc(20));
      });

      it('Should set the correct maximum Members', async () => {
        expect(await poolConfig.maxMembers(pool.address)).to.equal(4);
      });

      it('Should set the correct VotingThreshold', async () => {
        expect(await poolConfig.votingTime(pool.address)).to.equal(86400);
        expect(await poolConfig.votingThreshold(pool.address)).to.equal(74);
        expect(await poolConfig.minYesVoters(pool.address)).to.equal(1);
      });
    });

    describe('Pool Creation should fail with invalid config', () => {
      it('Should fail for invalid min Invest', async () => {
        await expect(
          createPool(poolLauncher, moritz, { minInvest: 0 })
        ).to.be.revertedWith('106: Invalid minInvest');
      });

      it('Should fail for invalid max Invest', async () => {
        await expect(
          createPool(poolLauncher, moritz, { minInvest: 10, maxInvest: 9 })
        ).to.be.reverted;
      });

      it('Should fail for invalid join amount', async () => {
        await expect(
          createPool(poolLauncher, moritz, { amount: 9, minInvest: 10 })
        ).to.be.reverted;

        await expect(
          createPool(poolLauncher, moritz, {
            amount: 15,
            minInvest: 5,
            maxInvest: 10,
          })
        ).to.be.reverted;
      });

      it('Should fail for invalid maximum Members', async () => {
        await expect(
          createPool(poolLauncher, moritz, { maxMembers: 0 })
        ).to.be.revertedWith('104: Invalid MaxMembers');
      });

      it('Should fail for invalid VotingThreshold', async () => {
        await expect(
          createPool(poolLauncher, moritz, { votingPercent: 101 })
        ).to.be.revertedWith('102: Invalid Voting Threshold (0-100)');

        await expect(
          createPool(poolLauncher, moritz, { votingTime: 0 })
        ).to.be.revertedWith('103: Invalid Voting Time');

        await expect(
          createPool(poolLauncher, moritz, { minYesVoters: 0 })
        ).to.be.revertedWith('105: Invalid minYesVoters');
      });
    });

    describe('Pool Config is modifyable through Proposals', () => {
      it('Should set maximum Members', async () => {
        await createProposal(
          backend,
          pool,
          moritz,
          'Change Maximum Members',
          'Increase Members to 5',
          [poolConfig.address],
          ['modifyMaxMembers(uint256)'],
          [abiCoder.encode(['uint256'], [5])]
        );
        await pool.executeProposal(0);
        expect(await poolConfig.maxMembers(pool.address)).to.equal(5);
      });

      it('Should set VotingThreshold', async () => {
        await createProposal(
          backend,
          pool,
          moritz,
          'Modify Voting Behaviour',
          'One hour time, minimum 20% and 2 yesVoters',
          [poolConfig.address, poolConfig.address, poolConfig.address],
          [
            'modifyVotingTime(uint256)',
            'modifyVotingThreshold(uint8)',
            'modifyMinYesVoters(uint256)',
          ],
          [
            abiCoder.encode(['uint256'], [3600]),
            abiCoder.encode(['uint8'], [20]),
            abiCoder.encode(['uint256'], [2]),
          ]
        );
        await pool.executeProposal(0);
        expect(await poolConfig.votingTime(pool.address)).to.equal(3600);
        expect(await poolConfig.votingThreshold(pool.address)).to.equal(20);
        expect(await poolConfig.minYesVoters(pool.address)).to.equal(2);
      });
    });

    describe('Pool Config works', () => {
      it('Should apply min & max Invest when joining', async () => {
        await expect(joinPool(backend, gerwin, pool, 9)).to.be.revertedWith(
          '200: Stake is lower than minInvest'
        );
        await expect(joinPool(backend, gerwin, pool, 21)).to.be.revertedWith(
          '201: Stake is higher than maxInvest'
        );
      });

      it('Should allow only the maximum amount of Members to join', async () => {
        await addToWhiteList(backend, moritz, pool, despot);
        await addToWhiteList(backend, moritz, pool, bob);
        await joinPool(backend, gerwin, pool, 10);
        await joinPool(backend, slava, pool, 10);
        await joinPool(backend, despot, pool, 10);
        await expect(joinPool(backend, bob, pool, 10)).to.be.revertedWith(
          '202: Member Limit reached'
        );
      });

      it('Should apply VotingRules to Proposals', async () => {
        await createPool(poolLauncher, moritz, {
          members: [gerwin.address, slava.address, despot.address],
          maxMembers: 4,
          votingPercent: 74,
          minYesVoters: 2,
        });
        const poolAddress = (await poolLauncher.allPools())[1];
        const pool = await ethers.getContractAt(
          'WunderPoolEta',
          poolAddress,
          moritz
        );
        await joinPool(backend, gerwin, pool, 12);
        await joinPool(backend, slava, pool, 10);
        await joinPool(backend, despot, pool, 10);
        await createProposal(
          backend,
          pool,
          moritz,
          'Change Maximum Members',
          'Increase Members to 5',
          [poolConfig.address],
          ['modifyMaxMembers(uint256)'],
          [abiCoder.encode(['uint'], [5])]
        );

        await expect(pool.executeProposal(0)).to.be.revertedWith(
          '310: Not enough Members voted yes'
        );
        await voteForUser(backend, gerwin, pool, 0, 1);
        await expect(pool.executeProposal(0)).to.be.revertedWith(
          '312: Voting still allowed'
        );
        await voteForUser(backend, slava, pool, 0, 1);
        await expect(pool.executeProposal(0)).to.not.be.reverted;
      });
    });

    describe('Moritz invites his friends to join', () => {
      it('Should Add Users to the WhiteList', async () => {
        await addToWhiteList(backend, moritz, pool, despot);

        expect(await pool.isWhiteListed(despot.address)).to.equal(true);
      });

      it('Whitelist should be updated', async () => {
        await addToWhiteList(backend, moritz, pool, despot);
        expect(await pool.poolWhitelist()).to.be.containingAllOf([
          gerwin.address,
          slava.address,
          despot.address,
        ]);
      });

      it('Should be able to create a `Magic Link`', async () => {
        await addToWhiteListSecret(backend, moritz, pool, 2, 'GEHEIM');
        expect(await pool.isWhiteListed(despot.address)).to.equal(false);
        expect(await pool.isWhiteListed(max.address)).to.equal(false);
        await expect(joinPool(backend, despot, pool, 10, 'GEHEIM')).to.not.be
          .reverted;
        await expect(joinPool(backend, max, pool, 10, 'GEHEIM')).to.not.be
          .reverted;
        await expect(
          joinPool(backend, bob, pool, 10, 'GEHEIM')
        ).to.be.revertedWith('207: Not On Whitelist');
        await expect(addToWhiteListSecret(backend, moritz, pool, 2, 'GEHEIM'))
          .to.be.reverted;
      });

      it('Registered Secrets are readable', async () => {
        const hashedSecret = await addToWhiteListSecret(
          backend,
          moritz,
          pool,
          3,
          'SUPERGEHEIM'
        );
        expect(await pool.secretWhiteList(hashedSecret)).to.equal(3);
        await expect(joinPool(backend, despot, pool, 10, 'SUPERGEHEIM')).to.not
          .be.reverted;
        expect(await pool.secretWhiteList(hashedSecret)).to.equal(2);
        await expect(joinPool(backend, max, pool, 10, 'SUPERGEHEIM')).to.not.be
          .reverted;
        expect(await pool.secretWhiteList(hashedSecret)).to.equal(1);
      });

      describe('Users Join the Pool', () => {
        beforeEach(async () => {
          treasuryBalance = await usdcBalance(treasury.address);
          await joinPool(backend, gerwin, pool, 10);
        });

        it('Gerwin can join because he was added to the whitelist', async () => {
          expect(
            (await poolLauncher.poolsOfMember(gerwin.address)).length
          ).to.equal(1);
          expect(await usdcBalance(pool.address)).to.equal(
            usdc(20).mul(97).div(100)
          );
          expect(await pool.isMember(gerwin.address)).to.equal(true);
        });

        it('Gerwin cant join twice', async () => {
          await expect(joinPool(backend, gerwin, pool, 10)).to.be.revertedWith(
            '204: Already Member'
          );
        });

        it('Treasury receives 3% of the joining amount', async () => {
          expect(await usdcBalance(treasury.address)).to.equal(
            treasuryBalance.add(usdc(0.3))
          );
        });

        it('Gerwin receives the correct amount of Governance Tokens', async () => {
          expect(await governanceToken.balanceOf(gerwin.address)).to.equal(
            usdc(10)
          );
        });

        it('Moritz can increase his stake in the Pool...', async () => {
          await topUp(moritz, usdc(10));
          await approve(moritz, pool.address, usdc(10));
          await pool.connect(moritz).fundPool(usdc(10));
          expect(await governanceToken.balanceOf(moritz.address)).to.equal(
            usdc(20)
          );
        });

        it('...but only to the maxInvest Limit...', async () => {
          await topUp(moritz, usdc(15));
          await approve(moritz, pool.address, usdc(15));
          await expect(
            pool.connect(moritz).fundPool(usdc(12))
          ).to.be.revertedWith('208: MaxInvest reached');
        });

        it('...And 3% go to the treasury', async () => {
          const treasuryBal = await usdcBalance(treasury.address);
          await topUp(moritz, usdc(10));
          await approve(moritz, pool.address, usdc(10));
          await pool.connect(moritz).fundPool(usdc(10));
          expect(await usdcBalance(treasury.address)).to.equal(
            treasuryBal.add(usdc(0.3))
          );
        });

        it('Slava cant join because the Pool is too expensive', async () => {
          await expect(joinPool(backend, slava, pool, 9)).to.be.revertedWith(
            '200: Stake is lower than minInvest'
          );
        });

        it('Bob cant join because he is not whitelisted', async () => {
          await expect(joinPool(backend, bob, pool, 20)).to.be.revertedWith(
            '207: Not On Whitelist'
          );
        });

        describe('After the first transaction', () => {
          beforeEach(async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Send me Cash',
              'Send me 5$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [moritz.address, usdc(5)])]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);
          });

          it('Despot cant join because the pool already made a transaction', async () => {
            await addToWhiteList(backend, moritz, pool, despot);
            await topUp(despot, usdc(100));
            await approve(despot, pool.address, usdc(100));
            await expect(
              pool.connect(backend).joinForUser(usdc(100), despot.address, '')
            ).to.be.revertedWith('110: Pool Closed');
          });

          it('Gerwin cant increase his stake in the Pool because the pool already made a transaction', async () => {
            await topUp(gerwin, usdc(100));
            await approve(gerwin, pool.address, usdc(100));
            await expect(
              pool.connect(gerwin).fundPool(usdc(100))
            ).to.be.revertedWith('110: Pool Closed');
          });
        });

        describe('Users can join after Pool was closed when...', () => {
          it('...they own governanceTokens', async () => {
            const balance = await governanceToken.balanceOf(moritz.address);
            await governanceToken.transfer(despot.address, balance.div(2));
            await pool.connect(backend).joinForUser(0, despot.address, '');
            expect(await pool.isMember(despot.address)).to.equal(true);
          });

          it('...they submit a joinPool Proposal', async () => {
            const treasuryBal = await usdcBalance(treasury.address);
            await createJoinProposal(
              backend,
              despot,
              pool,
              governanceToken,
              10,
              50
            );
            await voteForUser(backend, moritz, pool, 0, 1);
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);
            expect(await pool.isMember(despot.address)).to.equal(true);
            expect(await governanceToken.balanceOf(despot.address)).to.equal(
              50
            );
            expect(await usdcBalance(pool.address)).to.equal(
              usdc(30).mul(97).div(100)
            );
            expect(await usdcBalance(treasury.address)).to.equal(
              treasuryBal.add(usdc(0.3))
            );
          });
        });

        describe('Users Create, Vote and Execute Proposals', () => {
          let moritzShares, gerwinsShares;
          beforeEach(async () => {
            await addToWhiteList(backend, moritz, pool, slava);
            await joinPool(backend, slava, pool, 10);
            moritzShares = await governanceToken.balanceOf(moritz.address);
            gerwinsShares = await governanceToken.balanceOf(gerwin.address);

            await createProposal(
              backend,
              pool,
              moritz,
              'Send me Cash',
              'Send me 5$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [moritz.address, usdc(5)])]
            );
          });

          it('Members can create Proposals', async () => {
            await createProposal(
              backend,
              pool,
              gerwin,
              'Send Gerwin Cash',
              'Send me 5$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [gerwin.address, usdc(5)])]
            );

            expect((await pool.getAllProposalIds()).length).to.equal(2);

            expect(
              (await wunderProp.getProposal(pool.address, 1)).title
            ).to.equal('Send Gerwin Cash');
            expect(
              (await wunderProp.getProposal(pool.address, 1)).creator
            ).to.equal(gerwin.address);
          });

          it('Creator of a Proposal automatically votes yes', async () => {
            expect(
              (await wunderProp.getProposal(pool.address, 0)).yesVotes
            ).to.equal(moritzShares);

            await createProposal(
              backend,
              pool,
              gerwin,
              'Send Gerwin Cash',
              'Send me 5$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [gerwin.address, usdc(5)])]
            );

            expect(
              (await wunderProp.getProposal(pool.address, 1)).yesVotes
            ).to.equal(gerwinsShares);
          });

          it('Members can vote for Proposals', async () => {
            await voteForUser(backend, gerwin, pool, 0, 2);
            expect(
              (await wunderProp.getProposal(pool.address, 0)).noVotes
            ).to.equal(gerwinsShares);
          });

          it('Members can delegate their votes', async () => {
            await delegateVotes(backend, gerwin, governanceToken, moritz);
            expect(
              (await wunderProp.getProposal(pool.address, 0)).yesVotes
            ).to.equal(moritzShares.add(gerwinsShares));

            await revokeVotes(backend, gerwin, governanceToken);
            expect(
              (await wunderProp.getProposal(pool.address, 0)).yesVotes
            ).to.equal(moritzShares);
          });

          it('Members cant vote twice for the same Proposals', async () => {
            await voteForUser(backend, gerwin, pool, 0, 2);
            await expect(
              voteForUser(backend, gerwin, pool, 0, 2)
            ).to.be.revertedWith('307: Member has voted');
            expect(
              (await wunderProp.getProposal(pool.address, 0)).noVotes
            ).to.equal(gerwinsShares);
          });

          it('The Votes are calculated According to Governance Tokens', async () => {
            await topUp(gerwin, usdc(12));
            await approve(gerwin, pool.address, usdc(10));
            await pool.connect(gerwin).fundPool(usdc(10));
            const gerwinsTokens = await governanceToken.balanceOf(
              gerwin.address
            );

            expect(gerwinsTokens).to.equal(usdc(20));

            await voteForUser(backend, gerwin, pool, 0, 2);
            expect(
              (await wunderProp.getProposal(pool.address, 0)).noVotes
            ).to.equal(gerwinsTokens);
          });

          it('Bob cant create Proposals', async () => {
            await expect(
              createProposal(
                backend,
                pool,
                bob,
                'Send Bob Cash',
                'Send me 5$',
                [usdcAddress],
                ['transfer(address,uint256)'],
                [abiCoder.encode(['address', 'uint'], [bob.address, usdc(5)])]
              )
            ).to.be.revertedWith('203: Not a Member');
          });

          it('Bob cant vote for Proposals', async () => {
            await expect(
              voteForUser(backend, bob, pool, 0, 2)
            ).to.be.revertedWith('304: Only Members can vote');
          });

          it('Proposal cant be executed if no Majority is achieved', async () => {
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              '312: Voting still allowed'
            );
          });

          it('Proposal gets executed once Majority is reached', async () => {
            await voteForUser(backend, gerwin, pool, 0, 1);
            await voteForUser(backend, slava, pool, 0, 1);
            const tx = await pool.executeProposal(0);
            await expect(tx).to.emit(pool, 'ProposalExecuted');
          });

          it('Proposal cant be executed if it does not exist', async () => {
            await expect(pool.executeProposal(1)).to.be.revertedWith(
              '305: Proposal does not exist'
            );
          });

          it('Proposal cant be executed if Majority is against it', async () => {
            await voteForUser(backend, gerwin, pool, 0, 2);
            await voteForUser(backend, slava, pool, 0, 2);
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              '311: Majority voted against execution'
            );
          });

          it('Proposal cant be executed twice', async () => {
            await voteForUser(backend, gerwin, pool, 0, 1);
            await voteForUser(backend, slava, pool, 0, 1);
            await pool.executeProposal(0);
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              '309: Proposal already executed'
            );
          });
        });

        describe('Users trade Tokens', () => {
          let wunderSwapper, binanceToken;
          beforeEach(async () => {
            wunderSwapper = await deploySwapper({
              version: 'Eta',
              treasury: treasury.address,
              fee: 10,
              gnosis,
            });
            binanceToken = await ethers.getContractAt(
              'TestToken',
              '0x5c4b7CCBF908E64F32e12c6650ec0C96d717f03F',
              moritz
            );
          });

          it('Members can propose to Ape into a Token', async () => {
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              usdcAddress,
              binanceToken.address,
              usdc(10)
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
          });

          it('Token can be added to the Pool', async () => {
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              usdcAddress,
              binanceToken.address,
              usdc(10)
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            await pool.addToken(binanceToken.address, false, 0);
            expect((await pool.getOwnedTokenAddresses()).length).to.equal(2);
          });

          it('Token can be added to the Pool Programatically', async () => {
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              usdcAddress,
              binanceToken.address,
              usdc(10),
              true
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            expect((await pool.getOwnedTokenAddresses()).length).to.equal(2);
          });

          it('Members can propose to Sell a Token', async () => {
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              usdcAddress,
              binanceToken.address,
              usdc(10),
              true
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;

            const currentBalance = await binanceToken.balanceOf(pool.address);
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              binanceToken.address,
              usdcAddress,
              currentBalance
            );
            await voteForUser(backend, gerwin, pool, 1, 1);
            await expect(pool.executeProposal(1)).to.not.be.reverted;

            const balanceAfterSell = await binanceToken.balanceOf(pool.address);
            expect(balanceAfterSell).to.equal(0);
          });
        });

        describe('Users trade NFTs', () => {
          let testNft;
          beforeEach(async () => {
            const TestNft = await ethers.getContractFactory('TestNft');
            testNft = await TestNft.deploy(
              'RustyNft',
              'RTN',
              matic(1),
              usdc(1)
            );
          });

          it('Members can mint an NFT', async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [usdcAddress, testNft.address],
              ['approve(address,uint256)', 'mintUsd()'],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(1)]
                ),
                '0x',
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
          });

          it('NFT can be added to the Pool', async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [usdcAddress, testNft.address],
              ['approve(address,uint256)', 'mintUsd()'],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(1)]
                ),
                '0x',
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            await pool.addToken(testNft.address, true, 0);
            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(1);
          });

          it('NFT can be added to the Pool Programatically', async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [usdcAddress, testNft.address, pool.address],
              [
                'approve(address,uint256)',
                'mintUsd()',
                'addToken(address,bool,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(1)]
                ),
                '0x',
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(1);
          });

          it('Members can sell their own NFTs', async () => {
            await approve(moritz, testNft.address, usdc(1));
            await testNft.mintUsd();
            await testNft.approve(pool.address, 0);
            await createProposal(
              backend,
              pool,
              moritz,
              'Sell my Rusty NFT',
              'Sell it now',
              [testNft.address, pool.address],
              [
                'transferFrom(address,address,uint256)',
                'addToken(address,bool,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [moritz.address, pool.address, 0]
                ),
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);
            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(1);
          });

          it('Members can buy NFTs from the pool', async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [usdcAddress, testNft.address, pool.address],
              [
                'approve(address,uint256)',
                'mintUsd()',
                'addToken(address,bool,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(1)]
                ),
                '0x',
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);

            await approve(moritz, pool.address, usdc(2));
            await createProposal(
              backend,
              pool,
              moritz,
              'Buy a Rusty NFT',
              'Buy it now',
              [usdcAddress, testNft.address],
              [
                'transferFrom(address,address,uint256)',
                'transferFrom(address,address,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [moritz.address, pool.address, usdc(2)]
                ),
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [pool.address, moritz.address, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 1, 1);
            await pool.executeProposal(1);

            expect(await testNft.ownerOf(0)).to.equal(moritz.address);
          });

          it('NFT can be removed from the Pool if not owned by the Pool', async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [usdcAddress, testNft.address, pool.address],
              [
                'approve(address,uint256)',
                'mintUsd()',
                'addToken(address,bool,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(1)]
                ),
                '0x',
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(1);

            await approve(moritz, pool.address, usdc(2));
            await createProposal(
              backend,
              pool,
              moritz,
              'Buy a Rusty NFT',
              'Buy it now',
              [usdcAddress, testNft.address],
              [
                'transferFrom(address,address,uint256)',
                'transferFrom(address,address,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [moritz.address, pool.address, usdc(2)]
                ),
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [pool.address, moritz.address, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 1, 1);
            await pool.executeProposal(1);
            await pool.removeNft(testNft.address, 0);

            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(0);
          });

          it('NFT cant be removed from the Pool if owned by the Pool', async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [usdcAddress, testNft.address, pool.address],
              [
                'approve(address,uint256)',
                'mintUsd()',
                'addToken(address,bool,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(1)]
                ),
                '0x',
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(1);
            await pool.removeNft(testNft.address, 0);
            expect(
              (await pool.getOwnedNftTokenIds(testNft.address)).length
            ).to.equal(1);
          });
        });

        describe('Gerwin wants to leave the Pool', () => {
          let gerwinsShare, gerwinsUSDC;
          beforeEach(async () => {
            const gerwinsGOV = await governanceToken.balanceOf(gerwin.address);
            const totalGovs = await governanceToken.totalSupply();
            const poolUsdc = await usdcBalance(pool.address);
            gerwinsShare = poolUsdc.mul(gerwinsGOV).div(totalGovs);
            gerwinsUSDC = await usdcBalance(gerwin.address);
            const signature = await signMessage(
              gerwin,
              ['address', 'address', 'uint256'],
              [gerwin.address, pool.address, 0]
            );
            cashoutTx = await pool.cashoutForUser(gerwin.address, signature);
          });

          it('Transaction emits a CashOut Event', async () => {
            await expect(cashoutTx)
              .to.emit(pool, 'CashOut')
              .withArgs(gerwin.address);
          });

          it('Gerwin receives USDC for his GovernanceTokens', async () => {
            expect(await governanceToken.balanceOf(gerwin.address)).to.equal(0);
            expect(await usdcBalance(gerwin.address)).to.equal(
              gerwinsUSDC.add(gerwinsShare)
            );
          });

          it('Gerwin should be removed from Members', async () => {
            expect(await pool.poolMembers()).to.not.include(gerwin.address);
            expect(await pool.isMember(gerwin.address)).to.equal(false);
          });

          it('The Pool should be removed from Gerwins Pools', async () => {
            expect(
              await poolLauncher.poolsOfMember(gerwin.address)
            ).to.not.include(pool.address);
          });

          it('Gerwin should be able to join again', async () => {
            await expect(joinPool(backend, gerwin, pool, 10)).to.not.be
              .reverted;
            expect(await governanceToken.balanceOf(gerwin.address)).to.equal(
              usdc(10)
            );
            expect(await pool.isMember(gerwin.address)).to.equal(true);
            expect(await pool.poolMembers()).to.include(gerwin.address);
            expect(await poolLauncher.poolsOfMember(gerwin.address)).to.include(
              pool.address
            );
          });
        });

        describe('Users decide to liquidate the Pool', () => {
          let binanceToken,
            testNft,
            poolUsdcBalance,
            poolTokenBalance,
            moritzUsdcBalance,
            moritzTokenBalance,
            gerwinUsdcBalance,
            gerwinTokenBalance;
          beforeEach(async () => {
            const swapper = await deploySwapper({
              version: 'Eta',
              treasury: treasury.address,
              fee: 10,
              gnosis,
            });
            binanceToken = await ethers.getContractAt(
              'TestToken',
              '0x5c4b7CCBF908E64F32e12c6650ec0C96d717f03F',
              moritz
            );
            const TestNft = await ethers.getContractFactory('TestNft');
            testNft = await TestNft.deploy(
              'RustyNft',
              'RTN',
              matic(1),
              usdc(1)
            );
            await createSwapProposal(
              backend,
              pool,
              moritz,
              swapper.address,
              usdcAddress,
              binanceToken.address,
              usdc(5),
              true
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);

            await createProposal(
              backend,
              pool,
              moritz,
              'Mint a Rusty NFT',
              'Mint it now',
              [
                usdcAddress,
                testNft.address,
                testNft.address,
                testNft.address,
                testNft.address,
                pool.address,
                pool.address,
                pool.address,
                pool.address,
              ],
              [
                'approve(address,uint256)',
                'mintUsd()',
                'mintUsd()',
                'mintUsd()',
                'mintUsd()',
                'addToken(address,bool,uint256)',
                'addToken(address,bool,uint256)',
                'addToken(address,bool,uint256)',
                'addToken(address,bool,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'uint'],
                  [testNft.address, usdc(4)]
                ),
                '0x',
                '0x',
                '0x',
                '0x',
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 0]
                ),
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 1]
                ),
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 2]
                ),
                abiCoder.encode(
                  ['address', 'bool', 'uint'],
                  [testNft.address, true, 3]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 1, 1);
            await pool.executeProposal(1);

            poolUsdcBalance = await usdcBalance(pool.address);
            moritzUsdcBalance = await usdcBalance(moritz.address);
            gerwinUsdcBalance = await usdcBalance(gerwin.address);

            poolTokenBalance = await binanceToken.balanceOf(pool.address);
            moritzTokenBalance = await binanceToken.balanceOf(moritz.address);
            gerwinTokenBalance = await binanceToken.balanceOf(gerwin.address);

            await createProposal(
              backend,
              pool,
              moritz,
              'Liquidate The Pool',
              'Lets get out',
              [pool.address],
              ['liquidatePool()'],
              ['0x']
            );
            await voteForUser(backend, gerwin, pool, 2, 1);
          });

          it('Should distribute USDC fairly to all members', async () => {
            await pool.executeProposal(2);
            expect(await usdcBalance(moritz.address)).to.equal(
              moritzUsdcBalance.add(poolUsdcBalance.div(2))
            );
            expect(await usdcBalance(gerwin.address)).to.equal(
              gerwinUsdcBalance.add(poolUsdcBalance.div(2))
            );
          });

          it('Should distribute Tokens fairly to all members', async () => {
            await pool.executeProposal(2);
            expect(await binanceToken.balanceOf(moritz.address)).to.equal(
              moritzTokenBalance.add(poolTokenBalance.div(2))
            );
            expect(await binanceToken.balanceOf(gerwin.address)).to.equal(
              gerwinTokenBalance.add(poolTokenBalance.div(2))
            );
          });

          it('Should distribute NFTs randomly to all members', async () => {
            await pool.executeProposal(2);
            const moritzNftBalance = await testNft.balanceOf(moritz.address);
            const gerwinNftBalance = await testNft.balanceOf(gerwin.address);
            expect(moritzNftBalance.add(gerwinNftBalance)).to.equal(4);
          });

          it('Not removing an NFT after it was sold does not prevent liquidation', async () => {
            await topUp(slava, usdc(200));
            await approve(slava, pool.address, usdc(2));
            await createProposal(
              backend,
              pool,
              moritz,
              'Sell a Rusty NFT to Slava',
              'Sell it now',
              [usdcAddress, testNft.address],
              [
                'transferFrom(address,address,uint256)',
                'transferFrom(address,address,uint256)',
              ],
              [
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [slava.address, pool.address, usdc(2)]
                ),
                abiCoder.encode(
                  ['address', 'address', 'uint'],
                  [pool.address, slava.address, 0]
                ),
              ]
            );
            await voteForUser(backend, gerwin, pool, 3, 1);
            await pool.executeProposal(3);
            await pool.executeProposal(2);
            const moritzNftBalance = await testNft.balanceOf(moritz.address);
            const gerwinNftBalance = await testNft.balanceOf(gerwin.address);
            expect(moritzNftBalance.add(gerwinNftBalance)).to.equal(3);
          });

          it('Should destroy the Pool', async () => {
            await pool.executeProposal(2);
            await expect(pool.name()).to.be.reverted;
          });
        });
      });
    });
  });
});
