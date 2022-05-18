# WunderPool

- Deadline Minimum?

  - Members should have enough time to vote
  - Minimum Adjustable when createPool?
  - Minimum 2 Holder && 50% (Konfigurierbar)

- Two deadlines: One for voting period and one after which execution will be permitted if minority voted against it

- Make PoolConfig (e.g. minimumInvest) adjustable via proposal

- consider removing openProposalIds in WunderPool

- AutoVerify after event emitted (maybe adjust poolCreated event):
  ex. npx hardhat verify --network polygon 0x10c0c139db50bD2e475C980f70F1A9808d9f3977 "WunderPassTeamPool" "0x7e0b49362897706290b7312d0b0902a1629397d8" "0xc484B477BE6c3C58Fe3b4d3ede08BE96f47c5DEb" "0x5009cdEB9A4348cC91f77F653B56a1e494CCb12d" "1000000000000000000"
  npx hardhat verify --network polygon 0x76fDB74BC7E02e4faCA975087f90139cc869A9A6 "CryptoApes" "0x7e0b49362897706290b7312d0b0902a1629397d8" "0xc484B477BE6c3C58Fe3b4d3ede08BE96f47c5DEb" "0x62099b1413f44594Ac153b3fc76BCC6bb9234eC3" "100000000000000000"

- Perks depending on WunderPass NFT status

  - Early Access mit WP NFT

- Proposal should store the creator

- Remove Proposals that did not follow through

- require(proposal.value <= maxSpendingThreshold, "Execution not permitted: Proposal exceeds max spending Limit");
  Das sollte in submit Proposal rein und maxSpending Threshold kann dann von Admins angepasst werden.

- WunderPool liquidation should delete it from PoolLauncher

- Pool Main Währung beliebig (Nicht nur MATIC)

  - Vor Liquidierung umwandeln in EINE Währung (Main Währung)

- Make Pools upgradable through a Proposal in case of vulnerabilities or new Features

  1. If new constructor params are required, ask with a popup

- WunderSwapper getUsdcPriceOf

- WunderSwapper getBestPath => Manchmal ist der USDC Path nicht der beste. Check liquidity of pair oder price und wähle den besten

**_TESTING_**

- WunderSwapper function sellAllTokens(tokenAddress) => check balanceOf(msg.sender)

- WunderSwapper function swapAllTokens(tokenAddress) => check balanceOf(msg.sender)

- WunderSwapper Swap Tokens that don't have a QuickSwap Pair

**_DONE_**

- NFTs need to be removable from the pool

- MEMBERS MUST BE UNIQUE!!! (Currently Members can be added twice...)

- addToken function should check if Pool already owns the token
  In beta, you can add a token twice which can have unforseen consequences!

- NFT Support

  - addToken function should check if Pool owns an NFT
  - Im UI: Button, um NFT abzukaufen: Multi Proposal -> user.send(1 MATIC) => Pool, NFT.transfer(ueser, 1)
  - SelfDestruct: Auslosen wer einen NFT bekommt?

- Block Users from joining the Pool after first trade

- Detach Smart Contract Transactions from User by moving everything into the backend

  - JoinForUser
  - VoteForUser

- Use Proxy contracts

- destruct function

- Function in PoolLauncher:
  mapping(address => address[]) public memberToPools;
  function myPools(address member) returns(address[]) {
  return memberToPools[member];
  }

- Function in WunderPool:
  function isMember(address) {}

- Entrance Fee (as well as function increaseStake())

- Abstimmen über Auflösung des Pools und ändern der Regeln

- WunderTreasury (Give Members the Ability to buy and sell Governance Tokens from the Pools Treasury, aka buy and sell shares)
- Governance Token (affects weights, affected by entrance fee (Should be variable then somehow))

- WunderSwapper Swap Tokens that have a Quickswap pair

- Join Pool Function:
  ADD: function enterPool() public payable {
  require(publicPool, "Pool is private");
  require(msg.value >= minimumEntryFee, "Stake too low");
  members.push(\_newMember);
  \_grantRole(MEMBER_ROLE, msg.sender);
  }
  MODIFY: function addMember(address \_newMember) external onlyRole(ADMIN_ROLE) {
  require(!publicPool || minimumEntryFee == 0, "You can't add members as they have to pay");
  members.push(\_newMember);
  \_grantRole(MEMBER_ROLE, \_newMember);
  }
  Test if Pool gets msg.value

- In WunderPool:
  function getProposal should return if user has voted
