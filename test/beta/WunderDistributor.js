const chai = require('chai');
const assertArrays = require('chai-arrays');
const { createPool, joinPool } = require('../backend');
const { signMessage } = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;

const date = (dateStr = null) => {
  return Math.floor(
    (dateStr ? Number(new Date(dateStr)) : Number(new Date())) / 1000
  );
};

describe('WunderDistributor', () => {
  let distributor, poolLauncher, moritz, gerwin, slava, despot, max, backend;

  beforeEach(async () => {
    const WunderDistributor = await ethers.getContractFactory(
      'WunderDistributorBeta'
    );
    distributor = await WunderDistributor.deploy();
    [moritz, gerwin, slava, despot, max, backend] = await ethers.getSigners();

    const TknL = await ethers.getContractFactory('GovernanceTokenLauncherEta');
    const tknL = await TknL.deploy([distributor.address]);
    const PoolConfig = await ethers.getContractFactory('PoolConfigEta');
    const poolConfig = await PoolConfig.deploy(backend.address, 30);
    const WunderProp = await ethers.getContractFactory('WunderProposalEta');
    const wunderProp = await WunderProp.deploy(poolConfig.address);
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherEta');
    poolLauncher = await PoolLauncher.deploy(
      wunderProp.address,
      poolConfig.address,
      tknL.address
    );
  });

  describe('Create New Event', () => {
    let eventTx, startDate, endDate;
    beforeEach(async () => {
      startDate = date() + 600;
      endDate = date() + 3600;
      eventTx = await distributor.registerEvent(
        'WM Finale',
        startDate,
        endDate,
        0
      );
    });

    it('Should create a new Event', async () => {
      const { name, owner, resolved } = await distributor.getEvent(0);
      expect(name).to.equal('WM Finale');
      expect(owner).to.equal(moritz.address);
      expect(resolved).to.equal(false);
    });

    it('Should emit a NewEvent event', async () => {
      await expect(eventTx)
        .to.emit(distributor, 'NewEvent')
        .withArgs(0, 'WM Finale', endDate);
    });

    it('Should only allow the owner to set an outcome', async () => {
      await expect(
        distributor.connect(gerwin).setEventOutcome(0, [4, 2])
      ).to.be.revertedWith('503: Not allowed');
    });

    describe('Create New Game', () => {
      let pool, govToken, gameStake, gameTx;
      beforeEach(async () => {
        await createPool(poolLauncher, moritz, {
          members: [gerwin.address, slava.address, despot.address, max.address],
          amount: 10,
          minInvest: 3,
        });
        const poolAddress = (await poolLauncher.allPools())[0];
        pool = await ethers.getContractAt('WunderPoolEta', poolAddress, moritz);
        await joinPool(backend, gerwin, pool, 10);
        await joinPool(backend, despot, pool, 10);
        await joinPool(backend, max, pool, 10);
        const govTokenAddress = await pool.governanceToken();
        govToken = await ethers.getContractAt(
          'PoolGovernanceTokenEta',
          govTokenAddress,
          moritz
        );
        gameStake = (await govToken.balanceOf(moritz.address)).div(2);
        gameTx = await distributor.registerGame(
          'Moritz Balance Tipprunde',
          gameStake,
          govTokenAddress,
          0,
          0,
          false
        );
        await distributor.registerGame(
          'Moritz Approval Tipprunde',
          gameStake,
          govTokenAddress,
          0,
          0,
          true
        );
      });

      it('Should create a new Game', async () => {
        const { name, stake, tokenAddress, closed, participants } =
          await distributor.getGame(0);
        expect(name).to.equal('Moritz Balance Tipprunde');
        expect(stake).to.equal(gameStake);
        expect(tokenAddress).to.equal(govToken.address);
        expect(participants.length).to.equal(0);
        expect(closed).to.equal(false);
      });

      it('Should emit a NewGame event', async () => {
        await expect(gameTx)
          .to.emit(distributor, 'NewGame')
          .withArgs(0, 'Moritz Balance Tipprunde', 0);
      });

      it('Should not be possible to create a Game with a nonexisting Event', async () => {
        await expect(
          distributor.registerGame(
            'Moritz Tipprunde',
            gameStake,
            govToken.address,
            1,
            0,
            false
          )
        ).to.be.revertedWith('500: Event does not exist');
      });

      it('With Ownership: Should allow anyone to join if you own the token', async () => {
        expect(await distributor.connect(moritz).registerParticipant(0, [4, 2]))
          .to.emit(distributor, 'NewParticipant')
          .withArgs(0, 0, moritz.address);
      });

      it('With Ownership: Should not be possible to join if you dont own the token', async () => {
        await expect(
          distributor.connect(slava).registerParticipant(0, [4, 2])
        ).to.be.revertedWith('509: Insufficient Balance');
        await joinPool(backend, slava, pool, 3);
        await expect(
          distributor.connect(slava).registerParticipant(0, [4, 2])
        ).to.be.revertedWith('509: Insufficient Balance');
      });

      it('With Approval: Should allow anyone to join if you have approved the token', async () => {
        await govToken
          .connect(moritz)
          .increaseAllowance(distributor.address, gameStake);
        expect(await distributor.connect(moritz).registerParticipant(1, [4, 2]))
          .to.emit(distributor, 'NewParticipant')
          .withArgs(0, 0, moritz.address);
      });

      it('With Approval: Should not be possible to join if you did not approve the token', async () => {
        await expect(
          distributor.connect(moritz).registerParticipant(1, [4, 2])
        ).to.be.revertedWith('508: Not approved');
        await govToken
          .connect(moritz)
          .approve(distributor.address, gameStake.sub(1));
        await expect(
          distributor.connect(moritz).registerParticipant(1, [4, 2])
        ).to.be.revertedWith('508: Not approved');
      });

      it('Should be possible to join with Signature', async () => {
        const signature = await signMessage(
          moritz,
          ['uint256', 'address', 'uint256[]'],
          [0, distributor.address, [4, 2]]
        );
        expect(
          await distributor.registerParticipantForUser(
            0,
            [4, 2],
            moritz.address,
            signature
          )
        )
          .to.emit(distributor, 'NewParticipant')
          .withArgs(0, 0, moritz.address);
      });

      it('Participant cant join twice', async () => {
        await distributor.connect(moritz).registerParticipant(0, [4, 2]);
        await expect(
          distributor.connect(moritz).registerParticipant(0, [4, 2])
        ).to.be.revertedWith('501: Already Participant');
      });

      it('If participant joins multiple Games with the same token, the required approval amount is kept track of', async () => {
        await distributor.registerGame(
          'Moritz Zweite Balance Tipprunde',
          gameStake,
          govToken.address,
          0,
          0,
          false
        );
        await distributor.connect(moritz).registerParticipant(0, [4, 2]);
        await expect(
          distributor.connect(moritz).registerParticipant(1, [4, 2])
        ).to.be.revertedWith('508: Not approved');
        await govToken.connect(moritz).approve(distributor.address, gameStake);
        expect(await distributor.connect(moritz).registerParticipant(1, [4, 2]))
          .to.emit(distributor, 'NewParticipant')
          .withArgs(0, 1, moritz.address);
        await distributor.registerGame(
          'Moritz Dritte Balance Tipprunde',
          gameStake,
          govToken.address,
          0,
          0,
          false
        );
        await expect(
          distributor.connect(moritz).registerParticipant(2, [4, 2])
        ).to.be.revertedWith('509: Insufficient Balance');
      });

      it('Game can not be closed if event is unresolved', async () => {
        await expect(distributor.determineGame(0)).to.be.revertedWith(
          '506: Event not yet resolved'
        );
      });

      it('Betting is only allowed before startDate', async () => {
        await distributor.registerEvent('WM Finale', date() + 3, date(), 0);

        await distributor.registerGame(
          'Moritz Dritte Balance Tipprunde',
          gameStake,
          govToken.address,
          1,
          0,
          false
        );
        await expect(
          distributor.connect(moritz).registerParticipant(2, [4, 2])
        ).to.be.revertedWith('502: Betting Phase Expired');
        setTimeout(async () => {
          await distributor.connect(moritz).registerParticipant(2, [4, 2]);
        }, 3000);
      });

      describe('Game has ended', () => {
        it('Should mark the Game as closed', async () => {
          await distributor.setEventOutcome(0, [4, 2]);
          await distributor.connect(moritz).registerParticipant(0, [4, 2]);
          await distributor.determineGame(0);
          const { closed } = await distributor.getGame(0);
          expect(closed).to.equal(true);
          expect(await distributor.closedGames()).to.be.ofSize(1);
        });
      });

      describe('Payout Rules', () => {
        describe('Winner Takes it all', async () => {
          let priceMoney;
          beforeEach(async () => {
            await joinPool(backend, slava, pool, 10);
            await distributor.registerGame(
              'Moritz WinnerTakesAll Tipprunde',
              gameStake,
              govToken.address,
              0,
              0,
              false
            );
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = gameStake.mul(5);
          });

          it('Should correctly distribute Tokens for one winner', async () => {
            await distributor.connect(moritz).registerParticipant(2, [3, 1]);
            await distributor.connect(gerwin).registerParticipant(2, [2, 1]);
            await distributor.connect(slava).registerParticipant(2, [2, 2]);
            await distributor.connect(despot).registerParticipant(2, [1, 2]);
            await distributor.connect(max).registerParticipant(2, [0, 2]);

            const prevBalance = await govToken.balanceOf(moritz.address);
            await distributor.determineGame(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              prevBalance.sub(gameStake).add(priceMoney)
            );
          });

          it('Should correctly distribute Tokens for two winners', async () => {
            await distributor.connect(moritz).registerParticipant(2, [4, 2]);
            await distributor.connect(gerwin).registerParticipant(2, [4, 2]);
            await distributor.connect(slava).registerParticipant(2, [2, 2]);
            await distributor.connect(despot).registerParticipant(2, [1, 2]);
            await distributor.connect(max).registerParticipant(2, [0, 2]);

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            await distributor.determineGame(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance.sub(gameStake).add(priceMoney.div(2))
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance.sub(gameStake).add(priceMoney.div(2))
            );
          });

          it('Should not distribute any tokens if no winners', async () => {
            await distributor.connect(moritz).registerParticipant(2, [0, 2]);
            await distributor.connect(gerwin).registerParticipant(2, [0, 2]);
            await distributor.connect(slava).registerParticipant(2, [0, 2]);
            await distributor.connect(despot).registerParticipant(2, [0, 2]);
            await distributor.connect(max).registerParticipant(2, [0, 2]);

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineGame(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance
            );
            expect(await govToken.balanceOf(slava.address)).to.equal(
              slavaBalance
            );
            expect(await govToken.balanceOf(despot.address)).to.equal(
              despotBalance
            );
            expect(await govToken.balanceOf(max.address)).to.equal(maxBalance);
          });
        });

        describe('Proportional', async () => {
          let priceMoney;
          beforeEach(async () => {
            await joinPool(backend, slava, pool, 10);
            await distributor.registerGame(
              'Moritz Proportionale Tipprunde',
              gameStake,
              govToken.address,
              0,
              1,
              false
            );
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = gameStake.mul(5);
          });

          it('Should distribute tokens proportionally based on points', async () => {
            await distributor.connect(moritz).registerParticipant(2, [4, 2]); // 3 Points
            await distributor.connect(gerwin).registerParticipant(2, [3, 1]); // 2 Points
            await distributor.connect(slava).registerParticipant(2, [1, 0]); // 1 Points
            await distributor.connect(despot).registerParticipant(2, [0, 2]); // 0 Points
            await distributor.connect(max).registerParticipant(2, [4, 2]); // 3 Points

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineGame(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance.sub(gameStake).add(priceMoney.mul(3).div(9))
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance.sub(gameStake).add(priceMoney.mul(2).div(9))
            );
            expect(await govToken.balanceOf(slava.address)).to.equal(
              slavaBalance.sub(gameStake).add(priceMoney.mul(1).div(9))
            );
            expect(await govToken.balanceOf(despot.address)).to.equal(
              despotBalance.sub(gameStake).add(priceMoney.mul(0).div(9))
            );
            expect(await govToken.balanceOf(max.address)).to.equal(
              maxBalance.sub(gameStake).add(priceMoney.mul(3).div(9))
            );
          });
        });
      });
    });
  });
});
