const chai = require('chai');
const assertArrays = require('chai-arrays');
const { createPool, joinPool } = require('../backend');
const { signMessage } = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;

const date = (dateStr) => {
  return Number(new Date(dateStr));
};

describe('WunderDistributor', () => {
  let distributor, poolLauncher, moritz, gerwin, slava, despot, max, backend;

  beforeEach(async () => {
    const WunderDistributor = await ethers.getContractFactory(
      'WunderDistributorAlpha'
    );
    distributor = await WunderDistributor.deploy();
    [moritz, gerwin, slava, despot, max, backend] = await ethers.getSigners();

    const TknL = await ethers.getContractFactory('GovernanceTokenLauncherZeta');
    const tknL = await TknL.deploy();
    const PoolConfig = await ethers.getContractFactory('PoolConfigZeta');
    const poolConfig = await PoolConfig.deploy(backend.address, 30);
    const WunderProp = await ethers.getContractFactory('WunderProposalZeta');
    const wunderProp = await WunderProp.deploy(poolConfig.address);
    const PoolLauncher = await ethers.getContractFactory('PoolLauncherZeta');
    poolLauncher = await PoolLauncher.deploy(
      wunderProp.address,
      poolConfig.address,
      tknL.address
    );
  });

  describe('Create New Event', () => {
    let eventTx;
    beforeEach(async () => {
      eventTx = await distributor.registerEvent(
        'WM Finale',
        date('12.16.2022 18:00'),
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
        .withArgs(0, 'WM Finale', date('12.16.2022 18:00'));
    });

    it('Should only allow the owner to set an outcome', async () => {
      await expect(
        distributor.connect(gerwin).setEventOutcome(0, [4, 2])
      ).to.be.revertedWith('Not allowed');
    });

    describe('Create New Game', () => {
      let pool, govToken, gameStake, gameTx;
      beforeEach(async () => {
        await createPool(poolLauncher, moritz, {
          members: [gerwin.address, slava.address, despot.address, max.address],
          amount: 10,
        });
        const poolAddress = (await poolLauncher.allPools())[0];
        pool = await ethers.getContractAt(
          'WunderPoolZeta',
          poolAddress,
          moritz
        );
        await joinPool(backend, gerwin, pool, 10);
        await joinPool(backend, slava, pool, 10);
        await joinPool(backend, despot, pool, 10);
        await joinPool(backend, max, pool, 10);
        const govTokenAddress = await pool.governanceToken();
        govToken = await ethers.getContractAt(
          'PoolGovernanceTokenZeta',
          govTokenAddress,
          moritz
        );
        gameStake = (await govToken.balanceOf(moritz.address)).div(2);
        gameTx = await distributor.registerGame(
          'Moritz Tipprunde',
          gameStake,
          govTokenAddress,
          0,
          0
        );
      });

      it('Should create a new Game', async () => {
        const { name, stake, tokenAddress, closed, participants } =
          await distributor.getGame(0);
        expect(name).to.equal('Moritz Tipprunde');
        expect(stake).to.equal(gameStake);
        expect(tokenAddress).to.equal(govToken.address);
        expect(participants.length).to.equal(0);
        expect(closed).to.equal(false);
      });

      it('Should emit a NewGame event', async () => {
        await expect(gameTx)
          .to.emit(distributor, 'NewGame')
          .withArgs(0, 'Moritz Tipprunde', 0);
      });

      it('Should not be possible to create a Game with a nonexisting Event', async () => {
        await expect(
          distributor.registerGame(
            'Moritz Tipprunde',
            gameStake,
            govToken.address,
            1,
            0
          )
        ).to.be.revertedWith('Event does not exist');
      });

      it('Should allow anyone to join if you have approved the token', async () => {
        await govToken
          .connect(moritz)
          .increaseAllowance(distributor.address, gameStake);
        expect(await distributor.connect(moritz).registerParticipant(0, [4, 2]))
          .to.emit(distributor, 'NewParticipant')
          .withArgs(0, 0, moritz.address);
      });

      it('Should not be possible to join if you have not approved the token', async () => {
        await expect(
          distributor.connect(moritz).registerParticipant(0, [4, 2])
        ).to.be.revertedWith('Not approved');
        await govToken
          .connect(moritz)
          .approve(distributor.address, gameStake.sub(1));
        await expect(
          distributor.connect(moritz).registerParticipant(0, [4, 2])
        ).to.be.revertedWith('Not approved');
      });

      it('Should be possible to join with Signature', async () => {
        await govToken
          .connect(moritz)
          .increaseAllowance(distributor.address, gameStake);
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
        await govToken
          .connect(moritz)
          .increaseAllowance(distributor.address, gameStake);
        await distributor.connect(moritz).registerParticipant(0, [4, 2]);
        await expect(
          distributor.connect(moritz).registerParticipant(0, [4, 2])
        ).to.be.revertedWith('Already Participant');
      });

      it('If participant joins multiple Games with the same token, the required approval amount is kept track of', async () => {
        await govToken.connect(moritz).approve(distributor.address, gameStake);
        await distributor.connect(moritz).registerParticipant(0, [4, 2]);
        await distributor.registerGame(
          'Moritz Tipprunde Zwei',
          gameStake,
          govToken.address,
          0,
          0
        );
        await expect(
          distributor.connect(moritz).registerParticipant(1, [4, 2])
        ).to.be.revertedWith('Not approved');
        await govToken
          .connect(moritz)
          .approve(distributor.address, gameStake.mul(2));
        expect(await distributor.connect(moritz).registerParticipant(1, [4, 2]))
          .to.emit(distributor, 'NewParticipant')
          .withArgs(0, 1, moritz.address);
      });

      it('Game can not be closed if event is unresolved', async () => {
        await expect(distributor.determineGame(0)).to.be.revertedWith(
          'Event not yet resolved'
        );
      });

      describe('Game has ended', () => {
        beforeEach(async () => {
          const addr = distributor.address;
          await govToken.connect(moritz).increaseAllowance(addr, gameStake);
          await govToken.connect(gerwin).increaseAllowance(addr, gameStake);
          await distributor.setEventOutcome(0, [4, 2]);
        });

        it('Should fail if someone disapproved', async () => {
          await distributor.connect(moritz).registerParticipant(0, [4, 2]);
          await distributor.connect(gerwin).registerParticipant(0, [3, 2]);
          await govToken.connect(gerwin).approve(distributor.address, 0);

          const prevBalance = await govToken.balanceOf(moritz.address);
          await expect(distributor.determineGame(0)).to.be.revertedWith(
            'ERC20: insufficient allowance'
          );
          expect(await govToken.balanceOf(moritz.address)).to.equal(
            prevBalance
          );
        });

        it('Should mark the Game as closed', async () => {
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
            await distributor.registerGame(
              'Moritz WinnerTakesAll Tipprunde',
              gameStake,
              govToken.address,
              0,
              0
            );
            const addr = distributor.address;
            await govToken.connect(moritz).increaseAllowance(addr, gameStake);
            await govToken.connect(gerwin).increaseAllowance(addr, gameStake);
            await govToken.connect(slava).increaseAllowance(addr, gameStake);
            await govToken.connect(despot).increaseAllowance(addr, gameStake);
            await govToken.connect(max).increaseAllowance(addr, gameStake);
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = gameStake.mul(5);
          });

          it('Should correctly distribute Tokens for one winner', async () => {
            await distributor.connect(moritz).registerParticipant(1, [3, 1]);
            await distributor.connect(gerwin).registerParticipant(1, [2, 1]);
            await distributor.connect(slava).registerParticipant(1, [2, 2]);
            await distributor.connect(despot).registerParticipant(1, [1, 2]);
            await distributor.connect(max).registerParticipant(1, [0, 2]);

            const prevBalance = await govToken.balanceOf(moritz.address);
            await distributor.determineGame(1);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              prevBalance.sub(gameStake).add(priceMoney)
            );
          });

          it('Should correctly distribute Tokens for two winners', async () => {
            await distributor.connect(moritz).registerParticipant(1, [4, 2]);
            await distributor.connect(gerwin).registerParticipant(1, [4, 2]);
            await distributor.connect(slava).registerParticipant(1, [2, 2]);
            await distributor.connect(despot).registerParticipant(1, [1, 2]);
            await distributor.connect(max).registerParticipant(1, [0, 2]);

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            await distributor.determineGame(1);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance.sub(gameStake).add(priceMoney.div(2))
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance.sub(gameStake).add(priceMoney.div(2))
            );
          });

          it('Should not distribute any tokens if no winners', async () => {
            await distributor.connect(moritz).registerParticipant(1, [0, 2]);
            await distributor.connect(gerwin).registerParticipant(1, [0, 2]);
            await distributor.connect(slava).registerParticipant(1, [0, 2]);
            await distributor.connect(despot).registerParticipant(1, [0, 2]);
            await distributor.connect(max).registerParticipant(1, [0, 2]);

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineGame(1);

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
            await distributor.registerGame(
              'Moritz Proportionale Tipprunde',
              gameStake,
              govToken.address,
              0,
              1
            );
            const addr = distributor.address;
            await govToken.connect(moritz).increaseAllowance(addr, gameStake);
            await govToken.connect(gerwin).increaseAllowance(addr, gameStake);
            await govToken.connect(slava).increaseAllowance(addr, gameStake);
            await govToken.connect(despot).increaseAllowance(addr, gameStake);
            await govToken.connect(max).increaseAllowance(addr, gameStake);
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = gameStake.mul(5);
          });

          it('Should distribute tokens proportionally based on points', async () => {
            await distributor.connect(moritz).registerParticipant(1, [4, 2]); // 3 Points
            await distributor.connect(gerwin).registerParticipant(1, [3, 1]); // 2 Points
            await distributor.connect(slava).registerParticipant(1, [1, 0]); // 1 Points
            await distributor.connect(despot).registerParticipant(1, [0, 2]); // 0 Points
            await distributor.connect(max).registerParticipant(1, [4, 2]); // 3 Points

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineGame(1);

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
