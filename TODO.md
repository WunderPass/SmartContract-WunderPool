# WunderPool

- JoinPoolProposal erstellt von den Pool Membern und eingeladener User muss USDC autorisieren

- Invite with address[]

- Web2 Callback after Proposal (1Inch)

- Two deadlines: One for voting period and one after which execution will be permitted if minority voted against it

- consider removing openProposalIds in WunderPool

- Perks depending on WunderPass NFT status

  - Early Access mit WP NFT

- Remove Proposals that did not follow through

- WunderPool liquidation should delete it from PoolLauncher

- Pool Main Währung beliebig (Nicht nur MATIC)

  - Vor Liquidierung umwandeln in EINE Währung (Main Währung)

- Make Pools upgradable through a Proposal in case of vulnerabilities or new Features

  1. If new constructor params are required, ask with a popup

**_TESTING_**

- !!! Im Governancetoken beim transfer hook auf jeden Fall die votes updaten !!!

- Governance Token soll 1:1 zum Einsatz gemappt werden (dynamische Decimals abhängig vom Payment Token)

- WunderDistributor soll Transfer role bekommen im GovToken

- cashout Funktion

- Public Pools (Ohne whitelist, ohne invite, kein Quatsch)

- Autoliquidate?

- Error messages mit Error Code

**_DONE_**

- Events should have two dates (Start of event - Betting closed & End of event - Can be resolved)

  - endDate discarded as events do not always have a fixed endDate (e.g. soccer Game)

- Deposit Fee an WunderPass

- Pool speichert die gewhitelisteten Member in einem Array, damit diese aus dem Frontend/Backend ausgelesen werden können

- Nachträgliches Beitreten über:

  - function createJoinProposal(address \_user, uint \_amount) public
  - So wie es bisher ist, kann der User abgezockt werden, da er das Geld vorher autorisieren muss
    - Der Austausch von USDC gegen GovTokens muss im GovernanceToken Contract erfolgen:
      - Funktion: swapTokenToGovTokens(address \_user, address \_token, uint \_amount, uint \_shares, bytes signature) public onlyPool
      - GovToken Contract wird autorisiert statt des Pools
      - Signiert werden alle Input Parameter, damit keine Faxen gemacht werden können

- PoolConfig

  - minEntryBarrier
  - maxEntryBarrier
  - maximum Members
  - Deadline Minimum
    - Members should have enough time to vote
    - Minimum Adjustable when createPool?
    - Default: 1 week
  - VotingThreshold
    - Default: Minimum 2 Holder && 51%
  - Make PoolConfig adjustable via proposal

- Nachträgliches Beitreten über:

  - function joinForUser wenn User GovernanceTokens hat

- Beim whitelisten die möglichkeit geben, ein Passwort zu signieren/whitelisten anstatt einer Adresse (für User ohne WunderID)

- Address[] bei Pool creation übergeben zum whitelisten der Member

- Proposal should store the creator

- Übertragung der Stimmrechte

- WunderSwapper function sellAllTokens(tokenAddress) => check balanceOf(msg.sender)

- WunderSwapper function swapAllTokens(tokenAddress) => check balanceOf(msg.sender)

- WunderSwapper Swap Tokens that don't have a QuickSwap Pair

- WunderSwapper getUsdcPriceOf

- WunderSwapper getBestPath => Manchmal ist der USDC Path nicht der beste. Check liquidity of pair oder price und wähle den besten

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
