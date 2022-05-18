const chai = require('chai');
const assertArrays = require('chai-arrays');
const {
  addToWhiteList,
  joinPool,
  createProposal,
  voteForUser,
  createSwapProposal,
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
  let wunderProp, poolLauncher, moritz, gerwin, slava, despot, bob, backend;
  beforeEach(async () => {
    const WunderProp = await ethers.getContractFactory('WunderProposalDelta');
    wunderProp = await WunderProp.deploy();
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherDelta');
    poolLauncher = await PoolLauncher.deploy(wunderProp.address);
    [moritz, gerwin, slava, despot, bob, backend] = await ethers.getSigners();
  });

  describe('Moritz creates a new Pool', () => {
    let pool, govToken, abiCoder;
    beforeEach(async () => {
      abiCoder = new ethers.utils.AbiCoder();
      await poolLauncher.createNewPool(
        'Moritz Pool',
        usdc(10),
        'Moritz Pool Token',
        'MPT',
        usdc(1),
        moritz.address
      );
      const poolAddress = (await poolLauncher.allPools())[0];
      pool = await ethers.getContractAt('WunderPoolDelta', poolAddress, moritz);
      const govTokenAddress = await pool.governanceToken();
      govToken = await ethers.getContractAt(
        'PoolGovernanceTokenDelta',
        govTokenAddress,
        moritz
      );
    });

    it('Should launch a new WunderPool without Members', async () => {
      expect((await poolLauncher.allPools()).length).to.equal(1);
      expect(
        (await poolLauncher.poolsOfMember(moritz.address)).length
      ).to.equal(0);
      expect(await pool.name()).to.equal('Moritz Pool');
      expect(await usdcBalance(pool.address)).to.equal(usdc(0));
      expect(await pool.isMember(moritz.address)).to.equal(false);
    });

    it('Should launch a new Governance Token', async () => {
      expect(await govToken.name()).to.equal('Moritz Pool Token');
      expect(await govToken.symbol()).to.equal('MPT');
      expect(await govToken.decimals()).to.equal(0);
      expect(await govToken.balanceOf(moritz.address)).to.equal(0);
      expect(await govToken.launcherAddress()).to.equal(poolLauncher.address);
      expect(await govToken.poolAddress()).to.equal(pool.address);
      expect(await govToken.price()).to.equal(usdc(1));
    });

    it('Should whitelist Moritz because he created the pool', async () => {
      expect(
        (await poolLauncher.whiteListedPoolsOfMember(moritz.address)).length
      ).to.equal(1);
      expect(await pool.isWhiteListed(moritz.address)).to.equal(true);
    });

    it('Moritz cant whitelist members yet as he needs to join the pool first', async () => {
      const signature = await signMessage(
        moritz,
        ['address', 'address', 'address'],
        [moritz.address, pool.address, gerwin.address]
      );
      await expect(
        pool
          .connect(backend)
          .addToWhiteListForUser(moritz.address, gerwin.address, signature)
      ).to.be.revertedWith('Only Members can Invite new Users');
    });

    describe('Moritz joins and invites his friends to join', () => {
      beforeEach(async () => {
        await joinPool(backend, moritz, pool, 100);
      });

      it('Moritz can join because he is the creator', async () => {
        expect(
          (await poolLauncher.poolsOfMember(moritz.address)).length
        ).to.equal(1);
        expect(await usdcBalance(pool.address)).to.equal(usdc(100));
        expect(await pool.isMember(moritz.address)).to.equal(true);
        expect(await govToken.balanceOf(moritz.address)).to.equal(100);
      });

      it('Should Add Users to the WhiteList', async () => {
        await addToWhiteList(backend, moritz, pool, gerwin);

        expect(await pool.isWhiteListed(gerwin.address)).to.equal(true);
      });

      describe('Users Join the Pool', () => {
        beforeEach(async () => {
          await addToWhiteList(backend, moritz, pool, gerwin);
          await joinPool(backend, gerwin, pool, 100);
        });

        it('Gerwin can join because he was added to the whitelist', async () => {
          expect(
            (await poolLauncher.poolsOfMember(gerwin.address)).length
          ).to.equal(1);
          expect(await usdcBalance(pool.address)).to.equal(usdc(200));
          expect(await pool.isMember(gerwin.address)).to.equal(true);
        });

        it('Gerwin cant join twice', async () => {
          await topUp(gerwin, usdc(100));
          await approve(gerwin, pool.address, usdc(100));
          await expect(
            pool.connect(backend).joinForUser(usdc(100), gerwin.address)
          ).to.be.revertedWith('Already Member');
        });

        it('Gerwin receives the correct amount of Governance Tokens', async () => {
          expect(await govToken.balanceOf(gerwin.address)).to.equal(100);
        });

        it('Moritz can increase his stake in the Pool', async () => {
          await topUp(moritz, usdc(200));
          await approve(moritz, pool.address, usdc(200));
          await pool.connect(moritz).fundPool(usdc(200));
          expect(await govToken.balanceOf(moritz.address)).to.equal(300);
        });

        it('Slava cant join because the Pool is too expensive', async () => {
          await addToWhiteList(backend, moritz, pool, slava);
          await topUp(slava, usdc(200));
          await approve(slava, pool.address, usdc(200));
          await expect(
            pool.connect(backend).joinForUser(usdc(9), slava.address)
          ).to.be.revertedWith('Increase Stake');
        });

        it('Bob cant join because he is not whitelisted', async () => {
          await topUp(bob, usdc(200));
          await approve(bob, pool.address, usdc(200));
          await expect(
            pool.connect(backend).joinForUser(usdc(100), bob.address)
          ).to.be.revertedWith('Not On Whitelist');
        });

        describe('After the first transaction', () => {
          beforeEach(async () => {
            await createProposal(
              backend,
              pool,
              moritz,
              'Send me Cash',
              'Send me 50$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [moritz.address, usdc(50)])]
            );
            await voteForUser(backend, gerwin, pool, 0, 1);
            await pool.executeProposal(0);
          });

          it('Despot cant join because the pool already made a transaction', async () => {
            await addToWhiteList(backend, moritz, pool, despot);
            await topUp(despot, usdc(100));
            await approve(despot, pool.address, usdc(100));
            await expect(
              pool.connect(backend).joinForUser(usdc(100), despot.address)
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

        describe('Users Create, Vote and Execute Proposals', () => {
          let moritzShares, gerwinsShares;
          beforeEach(async () => {
            await addToWhiteList(backend, moritz, pool, slava);
            await joinPool(backend, slava, pool, 100);
            moritzShares = await govToken.balanceOf(moritz.address);
            gerwinsShares = await govToken.balanceOf(gerwin.address);

            await createProposal(
              backend,
              pool,
              moritz,
              'Send me Cash',
              'Send me 50$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [moritz.address, usdc(50)])]
            );
          });

          it('Members can create Proposals', async () => {
            await createProposal(
              backend,
              pool,
              gerwin,
              'Send Gerwin Cash',
              'Send me 50$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [gerwin.address, usdc(50)])]
            );

            expect((await pool.getAllProposalIds()).length).to.equal(2);

            expect(
              (await wunderProp.getProposal(pool.address, 1)).title
            ).to.equal('Send Gerwin Cash');
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
              'Send me 50$',
              [usdcAddress],
              ['transfer(address,uint256)'],
              [abiCoder.encode(['address', 'uint'], [gerwin.address, usdc(50)])]
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
            await topUp(gerwin, usdc(1100));
            await approve(gerwin, pool.address, usdc(1000));
            await pool.connect(gerwin).fundPool(usdc(1000));
            const gerwinsTokens = await govToken.balanceOf(gerwin.address);

            expect(gerwinsTokens).to.equal(1100);

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
                'Send me 50$',
                [usdcAddress],
                ['transfer(address,uint256)'],
                [abiCoder.encode(['address', 'uint'], [bob.address, usdc(50)])]
              )
            ).to.be.revertedWith('Only Members can create Proposals');
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
            await pool.executeProposal(0);
            await expect(pool.executeProposal(0)).to.be.revertedWith(
              'Proposal already executed'
            );
          });
        });

        describe('Users trade Tokens', () => {
          let wunderSwapper, sunMinerToken;
          beforeEach(async () => {
            const WS = await ethers.getContractFactory('WunderSwapperDelta');
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
            const WS = await ethers.getContractFactory('WunderSwapperDelta');
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
              usdc(50),
              true
            );
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
