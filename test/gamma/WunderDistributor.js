const chai = require('chai');
const assertArrays = require('chai-arrays');
const { createPool, joinPool } = require('../backend');
const {
  date,
  signMessage,
  usdcAddressGnosis,
  usdcAddress,
} = require('../helpers');
chai.use(assertArrays);
const expect = chai.expect;
const gnosis = true;

describe('WunderDistributor', () => {
  let distributor, poolLauncher, moritz, gerwin, slava, despot, max, backend;

  beforeEach(async () => {
    const WunderDistributor = await ethers.getContractFactory(
      'WunderDistributorGamma'
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
      tknL.address,
      gnosis ? usdcAddressGnosis : usdcAddress
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

    it('Should only allow the owner to update an event', async () => {
      await expect(
        distributor
          .connect(gerwin)
          .updateEvent(0, 'Gerwins Event', date() + 1000, date() + 4000)
      ).to.be.revertedWith('503: Not allowed');
    });

    describe('[Single Event] Create New Tournament', () => {
      let pool, govToken, tournamentStake, tournamentTx;
      beforeEach(async () => {
        await createPool(poolLauncher, moritz, {
          members: [gerwin.address, slava.address, despot.address, max.address],
          amount: 10,
          minInvest: 3,
          gnosis,
        });
        const poolAddress = (await poolLauncher.allPools())[0];
        pool = await ethers.getContractAt('WunderPoolEta', poolAddress, moritz);
        await joinPool(backend, gerwin, pool, 10, '', gnosis);
        await joinPool(backend, despot, pool, 10, '', gnosis);
        await joinPool(backend, max, pool, 10, '', gnosis);
        const govTokenAddress = await pool.governanceToken();
        govToken = await ethers.getContractAt(
          'PoolGovernanceTokenEta',
          govTokenAddress,
          moritz
        );
        tournamentStake = (await govToken.balanceOf(moritz.address)).div(2);
        tournamentTx = await distributor.registerTournament(
          'Moritz Balance Tipprunde',
          tournamentStake,
          govTokenAddress,
          [0],
          0,
          false
        );
        await distributor.registerTournament(
          'Moritz Approval Tipprunde',
          tournamentStake,
          govTokenAddress,
          [0],
          0,
          true
        );
      });

      it('Should create a new Tournament', async () => {
        const { name, stake, tokenAddress, closed, gameIds, members } =
          await distributor.getTournament(0);
        expect(name).to.equal('Moritz Balance Tipprunde');
        expect(stake).to.equal(tournamentStake);
        expect(tokenAddress).to.equal(govToken.address);
        expect(members.length).to.equal(0);
        expect(gameIds.length).to.equal(1);
        expect(closed).to.equal(false);
      });

      it('Should emit a NewTournament event', async () => {
        await expect(tournamentTx)
          .to.emit(distributor, 'NewTournament')
          .withArgs(0, 'Moritz Balance Tipprunde', [0]);
      });

      it('Should not be possible to create a Tournament with a nonexisting Event', async () => {
        await expect(
          distributor.registerTournament(
            'Moritz Tipprunde',
            tournamentStake,
            govToken.address,
            [1],
            0,
            false
          )
        ).to.be.revertedWith('500: Event does not exist');
      });

      it('With Ownership: Should allow anyone to join if you own the token', async () => {
        await expect(
          await distributor.connect(moritz).placeBet(0, [0], [[4, 2]])
        )
          .to.emit(distributor, 'NewTournamentMember')
          .withArgs(0, moritz.address);
      });

      it('With Ownership: Should not be possible to join if you dont own the token', async () => {
        await expect(
          distributor.connect(slava).placeBet(0, [0], [[4, 2]])
        ).to.be.revertedWith('509: Insufficient Balance');
        await joinPool(backend, slava, pool, 3, '', gnosis);
        await expect(
          distributor.connect(slava).placeBet(0, [0], [[4, 2]])
        ).to.be.revertedWith('509: Insufficient Balance');
      });

      it('With Approval: Should allow anyone to join if you have approved the token', async () => {
        await govToken
          .connect(moritz)
          .increaseAllowance(distributor.address, tournamentStake);
        const tx = await distributor.connect(moritz).placeBet(1, [1], [[4, 2]]);
        await expect(tx)
          .to.emit(distributor, 'NewTournamentMember')
          .withArgs(1, moritz.address);
      });

      it('With Approval: Should not be possible to join if you did not approve the token', async () => {
        await expect(
          distributor.connect(moritz).placeBet(1, [1], [[4, 2]])
        ).to.be.revertedWith('508: Not approved');
        await govToken
          .connect(moritz)
          .approve(distributor.address, tournamentStake.sub(1));
        await expect(
          distributor.connect(moritz).placeBet(1, [1], [[4, 2]])
        ).to.be.revertedWith('508: Not approved');
      });

      it('Should be possible to join with Signature', async () => {
        await distributor.registerTournament(
          'Moritz Balance Tipprunde',
          tournamentStake,
          govToken.address,
          [0],
          0,
          false
        );
        const signature = await signMessage(
          moritz,
          ['uint256', 'uint256[]', 'address', 'uint256[][]'],
          [2, [2], distributor.address, [[4, 2]]],
          false
        );
        const sigTx = await distributor.placeBetForUser(
          2,
          [2],
          [[4, 2]],
          moritz.address,
          signature
        );
        console.log((await distributor.getGame(2)).participants);
        await expect(sigTx)
          .to.emit(distributor, 'NewTournamentMember')
          .withArgs(2, moritz.address);
      });

      it('Participant cant join twice', async () => {
        await distributor.connect(moritz).placeBet(0, [0], [[4, 2]]);
        await expect(
          distributor.connect(moritz).placeBet(0, [0], [[4, 2]])
        ).to.be.revertedWith('501: Already Participant');
      });

      it('If participant joins multiple Games with the same token, the required approval amount is kept track of', async () => {
        await distributor.registerTournament(
          'Moritz Zweite Balance Tipprunde',
          tournamentStake,
          govToken.address,
          [0],
          0,
          false
        );
        await distributor.connect(moritz).placeBet(0, [0], [[4, 2]]);
        await expect(
          distributor.connect(moritz).placeBet(1, [1], [[4, 2]])
        ).to.be.revertedWith('508: Not approved');
        await govToken
          .connect(moritz)
          .approve(distributor.address, tournamentStake);
        await expect(
          await distributor.connect(moritz).placeBet(1, [1], [[4, 2]])
        )
          .to.emit(distributor, 'NewTournamentMember')
          .withArgs(1, moritz.address);
        await distributor.registerTournament(
          'Moritz Dritte Balance Tipprunde',
          tournamentStake,
          govToken.address,
          [0],
          0,
          false
        );
        await expect(
          distributor.connect(moritz).placeBet(2, [2], [[4, 2]])
        ).to.be.revertedWith('509: Insufficient Balance');
      });

      it('Tournament can not be closed if event is unresolved', async () => {
        await expect(distributor.determineTournament(0)).to.be.revertedWith(
          '506: Event not yet resolved'
        );
      });

      it('Betting is only allowed before startDate', async () => {
        const blockNumBefore = await ethers.provider.getBlockNumber();
        const blockBefore = await ethers.provider.getBlock(blockNumBefore);
        const timestampBefore = blockBefore.timestamp;
        await distributor.registerEvent(
          'WM Finale',
          timestampBefore + 10,
          date(),
          0
        );

        await distributor.registerTournament(
          'Moritz Dritte Balance Tipprunde',
          tournamentStake,
          govToken.address,
          [1],
          0,
          false
        );
        await distributor.connect(moritz).placeBet(2, [2], [[4, 2]]);
        await new Promise((res) => setTimeout(() => res(true), 10000));
        await expect(
          distributor.connect(gerwin).placeBet(2, [2], [[4, 2]])
        ).to.be.revertedWith('502: Betting Phase Expired');
      });

      describe('Tournament has ended', () => {
        it('Should mark the Tournament as closed', async () => {
          await distributor.setEventOutcome(0, [4, 2]);
          await distributor.connect(moritz).placeBet(0, [0], [[4, 2]]);
          await distributor.determineTournament(0);
          const { closed } = await distributor.getTournament(0);
          expect(closed).to.equal(true);
          expect(await distributor.closedTournaments()).to.be.ofSize(1);
        });
      });

      describe('Payout Rules', () => {
        describe('Winner Takes it all', async () => {
          let priceMoney;
          beforeEach(async () => {
            await joinPool(backend, slava, pool, 10, '', gnosis);
            await distributor.registerTournament(
              'Moritz WinnerTakesAll Tipprunde',
              tournamentStake,
              govToken.address,
              [0],
              0,
              false
            );
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = tournamentStake.mul(5);
          });

          it('Should correctly distribute Tokens for one winner', async () => {
            await distributor.connect(moritz).placeBet(2, [2], [[3, 1]]);
            await distributor.connect(gerwin).placeBet(2, [2], [[2, 1]]);
            await distributor.connect(slava).placeBet(2, [2], [[2, 2]]);
            await distributor.connect(despot).placeBet(2, [2], [[1, 2]]);
            await distributor.connect(max).placeBet(2, [2], [[0, 2]]);

            const prevBalance = await govToken.balanceOf(moritz.address);
            await distributor.determineTournament(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              prevBalance.sub(tournamentStake).add(priceMoney)
            );
          });

          it('Should correctly distribute Tokens for two winners', async () => {
            await distributor.connect(moritz).placeBet(2, [2], [[4, 2]]);
            await distributor.connect(gerwin).placeBet(2, [2], [[4, 2]]);
            await distributor.connect(slava).placeBet(2, [2], [[2, 2]]);
            await distributor.connect(despot).placeBet(2, [2], [[1, 2]]);
            await distributor.connect(max).placeBet(2, [2], [[0, 2]]);

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            await distributor.determineTournament(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance.sub(tournamentStake).add(priceMoney.div(2))
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance.sub(tournamentStake).add(priceMoney.div(2))
            );
          });

          it('Should not distribute any tokens if no winners', async () => {
            await distributor.connect(moritz).placeBet(2, [2], [[0, 2]]);
            await distributor.connect(gerwin).placeBet(2, [2], [[0, 2]]);
            await distributor.connect(slava).placeBet(2, [2], [[0, 2]]);
            await distributor.connect(despot).placeBet(2, [2], [[0, 2]]);
            await distributor.connect(max).placeBet(2, [2], [[0, 2]]);

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineTournament(2);

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

          it('GovernanceToken should update votes as well', async () => {
            await distributor.connect(moritz).placeBet(2, [2], [[3, 1]]);
            await distributor.connect(gerwin).placeBet(2, [2], [[2, 1]]);
            await distributor.connect(slava).placeBet(2, [2], [[2, 2]]);
            await distributor.connect(despot).placeBet(2, [2], [[1, 2]]);
            await distributor.connect(max).placeBet(2, [2], [[0, 2]]);

            const prevBalance = await govToken.votesOf(moritz.address);
            await distributor.determineTournament(2);

            expect(await govToken.votesOf(moritz.address)).to.equal(
              prevBalance.sub(tournamentStake).add(priceMoney)
            );
          });
        });

        describe('Proportional', async () => {
          let priceMoney;
          beforeEach(async () => {
            await joinPool(backend, slava, pool, 10, '', gnosis);
            await distributor.registerTournament(
              'Moritz Proportionale Tipprunde',
              tournamentStake,
              govToken.address,
              [0],
              1,
              false
            );
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = tournamentStake.mul(5);
          });

          it('Should distribute tokens proportionally based on points', async () => {
            await distributor.connect(moritz).placeBet(2, [2], [[4, 2]]); // 3 Points
            await distributor.connect(gerwin).placeBet(2, [2], [[3, 1]]); // 2 Points
            await distributor.connect(slava).placeBet(2, [2], [[1, 0]]); // 1 Points
            await distributor.connect(despot).placeBet(2, [2], [[0, 2]]); // 0 Points
            await distributor.connect(max).placeBet(2, [2], [[4, 2]]); // 3 Points

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineTournament(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance.sub(tournamentStake).add(priceMoney.mul(3).div(9))
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance.sub(tournamentStake).add(priceMoney.mul(2).div(9))
            );
            expect(await govToken.balanceOf(slava.address)).to.equal(
              slavaBalance.sub(tournamentStake).add(priceMoney.mul(1).div(9))
            );
            expect(await govToken.balanceOf(despot.address)).to.equal(
              despotBalance.sub(tournamentStake).add(priceMoney.mul(0).div(9))
            );
            expect(await govToken.balanceOf(max.address)).to.equal(
              maxBalance.sub(tournamentStake).add(priceMoney.mul(3).div(9))
            );
          });
        });

        describe('FiftyThirtyTwenty', async () => {
          let priceMoney;
          beforeEach(async () => {
            await joinPool(backend, slava, pool, 10, '', gnosis);
            await distributor.registerTournament(
              'Moritz Proportionale Tipprunde',
              tournamentStake,
              govToken.address,
              [0],
              2,
              false
            );
            await distributor.setEventOutcome(0, [4, 2]);
            priceMoney = tournamentStake.mul(5);
          });

          it('Should distribute tokens proportionally based on points', async () => {
            await distributor.connect(moritz).placeBet(2, [2], [[4, 2]]); // 3 Points
            await distributor.connect(gerwin).placeBet(2, [2], [[3, 1]]); // 2 Points
            await distributor.connect(slava).placeBet(2, [2], [[1, 0]]); // 1 Points
            await distributor.connect(despot).placeBet(2, [2], [[0, 2]]); // 0 Points
            await distributor.connect(max).placeBet(2, [2], [[4, 2]]); // 3 Points

            const moritzBalance = await govToken.balanceOf(moritz.address);
            const gerwinBalance = await govToken.balanceOf(gerwin.address);
            const slavaBalance = await govToken.balanceOf(slava.address);
            const despotBalance = await govToken.balanceOf(despot.address);
            const maxBalance = await govToken.balanceOf(max.address);
            await distributor.determineTournament(2);

            expect(await govToken.balanceOf(moritz.address)).to.equal(
              moritzBalance
                .sub(tournamentStake)
                .add(priceMoney.mul(5).div(10).div(2))
            );
            expect(await govToken.balanceOf(gerwin.address)).to.equal(
              gerwinBalance.sub(tournamentStake).add(priceMoney.mul(3).div(10))
            );
            expect(await govToken.balanceOf(slava.address)).to.equal(
              slavaBalance.sub(tournamentStake).add(priceMoney.mul(2).div(10))
            );
            expect(await govToken.balanceOf(despot.address)).to.equal(
              despotBalance.sub(tournamentStake).add(priceMoney.mul(0).div(10))
            );
            expect(await govToken.balanceOf(max.address)).to.equal(
              maxBalance
                .sub(tournamentStake)
                .add(priceMoney.mul(5).div(10).div(2))
            );
          });
        });
      });
    });

    describe('[Multi Event] Create New Tournament', () => {
      let pool, govToken, tournamentStake, tournamentTx;
      beforeEach(async () => {
        await createPool(poolLauncher, moritz, {
          members: [gerwin.address, slava.address, despot.address, max.address],
          amount: 10,
          minInvest: 3,
          gnosis,
        });
        const poolAddress = (await poolLauncher.allPools())[0];
        pool = await ethers.getContractAt('WunderPoolEta', poolAddress, moritz);
        await joinPool(backend, gerwin, pool, 10, '', gnosis);
        await joinPool(backend, despot, pool, 10, '', gnosis);
        await joinPool(backend, max, pool, 10, '', gnosis);
        await joinPool(backend, slava, pool, 10, '', gnosis);
        const govTokenAddress = await pool.governanceToken();
        govToken = await ethers.getContractAt(
          'PoolGovernanceTokenEta',
          govTokenAddress,
          moritz
        );
        tournamentStake = (await govToken.balanceOf(moritz.address)).div(2);
        await distributor.registerEvent(
          'Germany vs. Spain',
          date() + 600,
          date(),
          0
        );
        await distributor.registerEvent(
          'Germany vs. Japan',
          date() + 600,
          date(),
          0
        );
        tournamentTx = await distributor.registerTournament(
          'Multi Event Tournament',
          tournamentStake,
          govTokenAddress,
          [1, 2],
          2,
          false
        );
      });

      it('Should create a new Tournament', async () => {
        const { gameIds } = await distributor.getTournament(0);
        expect(gameIds.length).to.equal(2);
      });

      it('Should emit a NewTournament event', async () => {
        await expect(tournamentTx)
          .to.emit(distributor, 'NewTournament')
          .withArgs(0, 'Multi Event Tournament', [0, 1]);
      });

      it('Should be possible to place a single bet', async () => {
        // Place first Bet
        await distributor.connect(moritz).placeBet(0, [0], [[4, 2]]);
        expect((await distributor.getTournament(0)).members).to.eql([
          moritz.address,
        ]);
        expect((await distributor.getGame(0)).participants.length).to.equal(1);
        expect((await distributor.getGame(1)).participants.length).to.equal(0);

        // Place second Bet
        await distributor.connect(moritz).placeBet(0, [1], [[4, 2]]);
        expect((await distributor.getTournament(0)).members).to.eql([
          moritz.address,
        ]);
        expect((await distributor.getGame(1)).participants.length).to.equal(1);
      });

      it('Should be possible to place multiple bets at once', async () => {
        await distributor.connect(moritz).placeBet(
          0,
          [0, 1],
          [
            [4, 2],
            [6, 9],
          ]
        );
        expect((await distributor.getTournament(0)).members).to.eql([
          moritz.address,
        ]);

        const gameOne = await distributor.getGame(0);
        const gameTwo = await distributor.getGame(1);
        expect(
          gameOne.participants[0].prediction.map((p) => p.toNumber())
        ).to.eql([4, 2]);
        expect(
          gameTwo.participants[0].prediction.map((p) => p.toNumber())
        ).to.eql([6, 9]);
      });

      it('Calculates the correct payout', async () => {
        await distributor.setEventOutcome(1, [4, 2]);
        await distributor.setEventOutcome(2, [6, 9]);
        const priceMoney = tournamentStake.mul(5);
        await distributor.connect(moritz).placeBet(
          0,
          [0, 1],
          [
            [4, 2],
            [6, 9],
          ]
        ); // 6 Points
        await distributor.connect(gerwin).placeBet(
          0,
          [0, 1],
          [
            [3, 1],
            [6, 9],
          ]
        ); // 5 Points
        await distributor.connect(despot).placeBet(
          0,
          [0, 1],
          [
            [3, 1],
            [5, 8],
          ]
        ); // 4 Points
        await distributor.connect(max).placeBet(
          0,
          [0, 1],
          [
            [0, 1],
            [6, 9],
          ]
        ); // 3 Points
        await distributor.connect(slava).placeBet(
          0,
          [0, 1],
          [
            [0, 1],
            [5, 8],
          ]
        ); // 2 Points
        const moritzBalance = await govToken.balanceOf(moritz.address);
        const gerwinBalance = await govToken.balanceOf(gerwin.address);
        const slavaBalance = await govToken.balanceOf(slava.address);
        const despotBalance = await govToken.balanceOf(despot.address);
        const maxBalance = await govToken.balanceOf(max.address);
        await distributor.determineTournament(0);

        expect(await govToken.balanceOf(moritz.address)).to.equal(
          moritzBalance.sub(tournamentStake).add(priceMoney.mul(5).div(10))
        );
        expect(await govToken.balanceOf(gerwin.address)).to.equal(
          gerwinBalance.sub(tournamentStake).add(priceMoney.mul(3).div(10))
        );
        expect(await govToken.balanceOf(despot.address)).to.equal(
          despotBalance.sub(tournamentStake).add(priceMoney.mul(2).div(10))
        );
        expect(await govToken.balanceOf(max.address)).to.equal(
          maxBalance.sub(tournamentStake).add(priceMoney.mul(0).div(10))
        );
        expect(await govToken.balanceOf(slava.address)).to.equal(
          slavaBalance.sub(tournamentStake).add(priceMoney.mul(0).div(10))
        );
      });

      it('Calculates the correct payout if someone did not vote', async () => {
        await distributor.setEventOutcome(1, [4, 2]);
        await distributor.setEventOutcome(2, [6, 9]);
        const priceMoney = tournamentStake.mul(5);
        await distributor.connect(moritz).placeBet(
          0,
          [0, 1],
          [
            [4, 2],
            [6, 9],
          ]
        ); // 6 Points
        await distributor.connect(gerwin).placeBet(0, [0], [[3, 1]]); // 2 Points
        await distributor.connect(despot).placeBet(0, [1], [[6, 9]]); // 3 Points
        await distributor.connect(max).placeBet(
          0,
          [0, 1],
          [
            [0, 1],
            [6, 9],
          ]
        ); // 3 Points
        await distributor.connect(slava).placeBet(
          0,
          [0, 1],
          [
            [0, 1],
            [1, 0],
          ]
        ); // 0 Points
        const moritzBalance = await govToken.balanceOf(moritz.address);
        const gerwinBalance = await govToken.balanceOf(gerwin.address);
        const slavaBalance = await govToken.balanceOf(slava.address);
        const despotBalance = await govToken.balanceOf(despot.address);
        const maxBalance = await govToken.balanceOf(max.address);
        await distributor.determineTournament(0);

        expect(await govToken.balanceOf(moritz.address)).to.equal(
          moritzBalance.sub(tournamentStake).add(priceMoney.mul(5).div(10))
        );
        expect(await govToken.balanceOf(gerwin.address)).to.equal(
          gerwinBalance.sub(tournamentStake).add(priceMoney.mul(2).div(10))
        );
        expect(await govToken.balanceOf(despot.address)).to.equal(
          despotBalance
            .sub(tournamentStake)
            .add(priceMoney.mul(3).div(10).div(2))
        );
        expect(await govToken.balanceOf(max.address)).to.equal(
          maxBalance.sub(tournamentStake).add(priceMoney.mul(3).div(10).div(2))
        );
        expect(await govToken.balanceOf(slava.address)).to.equal(
          slavaBalance.sub(tournamentStake).add(priceMoney.mul(0).div(10))
        );
      });
    });
  });
});
