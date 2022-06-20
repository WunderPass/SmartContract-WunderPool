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
const {
  usdc,
  usdcBalance,
  usdcAddress,
  matic,
  topUp,
  approve,
  signMessage,
} = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;

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
    backend;
  beforeEach(async () => {
    const GovernanceTokenLauncher = await ethers.getContractFactory(
      'GovernanceTokenLauncherEpsilon'
    );
    const governanceTokenLauncher = await GovernanceTokenLauncher.deploy();
    const PoolConfig = await ethers.getContractFactory('PoolConfigEpsilon');
    poolConfig = await PoolConfig.deploy();
    const WunderProp = await ethers.getContractFactory('WunderProposalEpsilon');
    wunderProp = await WunderProp.deploy(poolConfig.address);
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherEpsilon');
    poolLauncher = await PoolLauncher.deploy(
      wunderProp.address,
      poolConfig.address,
      governanceTokenLauncher.address
    );
    [moritz, gerwin, slava, despot, max, bob, backend] =
      await ethers.getSigners();
  });

  describe('Moritz creates a new Pool', () => {
    let pool, govToken, abiCoder;
    beforeEach(async () => {
      abiCoder = new ethers.utils.AbiCoder();
      await createPool(poolLauncher, moritz, {
        members: [gerwin.address, slava.address],
        maxMembers: 4,
        votingPercent: 74,
      });
      const poolAddress = (await poolLauncher.allPools())[0];
      pool = await ethers.getContractAt(
        'WunderPoolEpsilon',
        poolAddress,
        moritz
      );
      const govTokenAddress = await pool.govToken();
      govToken = await ethers.getContractAt(
        'PoolGovernanceTokenEpsilon',
        govTokenAddress,
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
      expect(await govToken.name()).to.equal('Dorsch Pool Token');
      expect(await govToken.symbol()).to.equal('DPT');
      expect(await govToken.decimals()).to.equal(0);
      expect(await govToken.balanceOf(moritz.address)).to.equal(100);
      expect(await govToken.launcherAddress()).to.equal(poolLauncher.address);
      expect(await govToken.poolAddress()).to.equal(pool.address);
      expect(await govToken.price()).to.equal(usdc(0.1));
    });

    it('Should transfer the USDC from Moritz to the Pool', async () => {
      expect(await usdcBalance(pool.address)).to.equal(usdc(10));
    });

    describe('The Pool is correctly configuered', () => {
      it('Should have two whitelisted Members', async () => {
        expect(await pool.isWhiteListed(gerwin.address)).to.equal(true);
        expect(await pool.isWhiteListed(slava.address)).to.equal(true);
        expect(await pool.isWhiteListed(despot.address)).to.equal(false);
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
        ).to.be.revertedWith('Invalid minInvest');
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
        ).to.be.revertedWith('Invalid MaxMembers');
      });

      it('Should fail for invalid VotingThreshold', async () => {
        await expect(
          createPool(poolLauncher, moritz, { votingPercent: 101 })
        ).to.be.revertedWith('Invalid Voting Threshold (0-100)');

        await expect(
          createPool(poolLauncher, moritz, { votingTime: 0 })
        ).to.be.revertedWith('Invalid Voting Time');

        await expect(
          createPool(poolLauncher, moritz, { minYesVoters: 0 })
        ).to.be.revertedWith('Invalid minYesVoters');
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
          'Stake is lower than minInvest'
        );
        await expect(joinPool(backend, gerwin, pool, 21)).to.be.revertedWith(
          'Stake is higher than maxInvest'
        );
      });

      it('Should allow only the maximum amount of Members to join', async () => {
        await addToWhiteList(backend, moritz, pool, despot);
        await addToWhiteList(backend, moritz, pool, bob);
        await joinPool(backend, gerwin, pool, 10);
        await joinPool(backend, slava, pool, 10);
        await joinPool(backend, despot, pool, 10);
        await expect(joinPool(backend, bob, pool, 10)).to.be.revertedWith(
          'Member Limit reached'
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
          'WunderPoolEpsilon',
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
          'Not enough Members voted yes'
        );
        await voteForUser(backend, gerwin, pool, 0, 1);
        await expect(pool.executeProposal(0)).to.be.revertedWith(
          'Voting still allowed'
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
        ).to.be.revertedWith('Not On Whitelist');
        await expect(addToWhiteListSecret(backend, moritz, pool, 2, 'GEHEIM'))
          .to.be.reverted;
      });

      describe('Users Join the Pool', () => {
        beforeEach(async () => {
          await joinPool(backend, gerwin, pool, 10);
        });

        it('Gerwin can join because he was added to the whitelist', async () => {
          expect(
            (await poolLauncher.poolsOfMember(gerwin.address)).length
          ).to.equal(1);
          expect(await usdcBalance(pool.address)).to.equal(usdc(20));
          expect(await pool.isMember(gerwin.address)).to.equal(true);
        });

        it('Gerwin cant join twice', async () => {
          await expect(joinPool(backend, gerwin, pool, 10)).to.be.revertedWith(
            'Already Member'
          );
        });

        it('Gerwin receives the correct amount of Governance Tokens', async () => {
          expect(await govToken.balanceOf(gerwin.address)).to.equal(100);
        });

        it('Moritz can increase his stake in the Pool...', async () => {
          await topUp(moritz, usdc(10));
          await approve(moritz, pool.address, usdc(10));
          await pool.connect(moritz).fundPool(usdc(10));
          expect(await govToken.balanceOf(moritz.address)).to.equal(200);
        });

        it('...but only to the maxInvest Limit', async () => {
          await topUp(moritz, usdc(15));
          await approve(moritz, pool.address, usdc(15));
          await expect(
            pool.connect(moritz).fundPool(usdc(12))
          ).to.be.revertedWith('maxInvest reached');
        });

        it('Slava cant join because the Pool is too expensive', async () => {
          await expect(joinPool(backend, slava, pool, 9)).to.be.revertedWith(
            'Stake is lower than minInvest'
          );
        });

        it('Bob cant join because he is not whitelisted', async () => {
          await expect(joinPool(backend, bob, pool, 20)).to.be.revertedWith(
            'Not On Whitelist'
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
            ).to.be.revertedWith('Pool Closed');
          });

          it('Gerwin cant increase his stake in the Pool because the pool already made a transaction', async () => {
            await topUp(gerwin, usdc(100));
            await approve(gerwin, pool.address, usdc(100));
            await expect(
              pool.connect(gerwin).fundPool(usdc(100))
            ).to.be.revertedWith('Pool Closed');
          });
        });

        describe('Users can join after Pool was closed when...', () => {
          it('...they own governanceTokens', async () => {
            const balance = await govToken.balanceOf(moritz.address);
            await govToken.transfer(despot.address, balance.div(2));
            await pool.connect(backend).joinForUser(0, despot.address, '');
            expect(await pool.isMember(despot.address)).to.equal(true);
          });

          it('...they submit a joinPool Proposal', async () => {
            await createJoinProposal(backend, despot, pool, 10, 50);
            await voteForUser(backend, moritz, pool, 0, 1);
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);
            expect(await pool.isMember(despot.address)).to.equal(true);
            expect(await govToken.balanceOf(despot.address)).to.equal(50);
            expect(await usdcBalance(pool.address)).to.equal(usdc(30));
          });
        });

        describe('Users Create, Vote and Execute Proposals', () => {
          let moritzShares, gerwinsShares;
          beforeEach(async () => {
            await addToWhiteList(backend, moritz, pool, slava);
            await joinPool(backend, slava, pool, 10);
            moritzShares = await govToken.balanceOf(moritz.address);
            gerwinsShares = await govToken.balanceOf(gerwin.address);

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
            await delegateVotes(backend, gerwin, govToken, moritz);
            expect(
              (await wunderProp.getProposal(pool.address, 0)).yesVotes
            ).to.equal(moritzShares.add(gerwinsShares));

            await revokeVotes(backend, gerwin, govToken);
            expect(
              (await wunderProp.getProposal(pool.address, 0)).yesVotes
            ).to.equal(moritzShares);
          });

          it('Members cant vote twice for the same Proposals', async () => {
            await voteForUser(backend, gerwin, pool, 0, 2);
            await expect(
              voteForUser(backend, gerwin, pool, 0, 2)
            ).to.be.revertedWith('Member has voted');
            expect(
              (await wunderProp.getProposal(pool.address, 0)).noVotes
            ).to.equal(gerwinsShares);
          });

          it('The Votes are calculated According to Governance Tokens', async () => {
            await topUp(gerwin, usdc(12));
            await approve(gerwin, pool.address, usdc(10));
            await pool.connect(gerwin).fundPool(usdc(10));
            const gerwinsTokens = await govToken.balanceOf(gerwin.address);

            expect(gerwinsTokens).to.equal(200);

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
            ).to.be.revertedWith('Not a Member');
          });

          it('Bob cant vote for Proposals', async () => {
            await expect(
              voteForUser(backend, bob, pool, 0, 2)
            ).to.be.revertedWith('Only Members can vote');
          });

          it('Proposal cant be executed if no Majority is achieved', async () => {
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              'Voting still allowed'
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
              'Proposal does not exist'
            );
          });

          it('Proposal cant be executed if Majority is against it', async () => {
            await voteForUser(backend, gerwin, pool, 0, 2);
            await voteForUser(backend, slava, pool, 0, 2);
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              'Majority voted against execution'
            );
          });

          it('Proposal cant be executed twice', async () => {
            await voteForUser(backend, gerwin, pool, 0, 1);
            await voteForUser(backend, slava, pool, 0, 1);
            await pool.executeProposal(0);
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              'Proposal already executed'
            );
          });
        });

        describe('Users trade Tokens', () => {
          let wunderSwapper, sunMinerToken;
          beforeEach(async () => {
            const WS = await ethers.getContractFactory('WunderSwapperEpsilon');
            wunderSwapper = await WS.deploy();
            sunMinerToken = await ethers.getContractAt(
              'TestToken',
              '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c',
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
              sunMinerToken.address,
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
              sunMinerToken.address,
              usdc(10)
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;
            await pool.addToken(sunMinerToken.address, false, 0);
            expect((await pool.getOwnedTokenAddresses()).length).to.equal(2);
          });

          it('Token can be added to the Pool Programatically', async () => {
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              usdcAddress,
              sunMinerToken.address,
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
              sunMinerToken.address,
              usdc(10),
              true
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await expect(pool.executeProposal(0)).to.not.be.reverted;

            const currentBalance = await sunMinerToken.balanceOf(pool.address);
            await createSwapProposal(
              backend,
              pool,
              moritz,
              wunderSwapper.address,
              sunMinerToken.address,
              usdcAddress,
              currentBalance
            );
            await voteForUser(backend, gerwin, pool, 1, 1);
            await expect(pool.executeProposal(1)).to.not.be.reverted;

            const balanceAfterSell = await sunMinerToken.balanceOf(
              pool.address
            );
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

        describe('Users decide to liquidate the Pool', () => {
          let sunMinerToken,
            testNft,
            poolUsdcBalance,
            poolTokenBalance,
            moritzUsdcBalance,
            moritzTokenBalance,
            gerwinUsdcBalance,
            gerwinTokenBalance;
          beforeEach(async () => {
            const WS = await ethers.getContractFactory('WunderSwapperEpsilon');
            const swapper = await WS.deploy();
            sunMinerToken = await ethers.getContractAt(
              'TestToken',
              '0x902478ADDb45514f36B57ca0B9Ab853f95125E1c',
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
              sunMinerToken.address,
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

            poolTokenBalance = await sunMinerToken.balanceOf(pool.address);
            moritzTokenBalance = await sunMinerToken.balanceOf(moritz.address);
            gerwinTokenBalance = await sunMinerToken.balanceOf(gerwin.address);

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
            expect(await sunMinerToken.balanceOf(moritz.address)).to.equal(
              moritzTokenBalance.add(poolTokenBalance.div(2))
            );
            expect(await sunMinerToken.balanceOf(gerwin.address)).to.equal(
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
