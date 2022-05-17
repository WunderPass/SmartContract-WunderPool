# Relevante Funktionen der Pool Contracts

Dies ist die Dokumentation für die WunderPool Smart Contracts.
Die Addressen der Contracts sind [hier](https://github.com/WunderPass/SmartContract-WunderPool/blob/master/README.md) aufgelistet.

## User Journey

### 1. Create Pool

**CONTRACT: PoolLauncher**

```solidity
function createNewPool(string poolName, uint256 entryBarrier, string tokenName, string tokenSymbol, uint256 tokenPrice, address creator)
```

Erstellt einen neuen WunderPool Contract und einen neuen PoolGovernanceToken Contract mit der entsprechenden Konfiguration.
Außerdem wird der `creator` in dem erstellten WunderPool auf die WhiteList gesetzt, wodurch er dem Pool beitreten kann.
Der `tokenPrice` ist der Festgesetzte Preis pro Stimme (Preis pro GovernanceToken) in USDC (1,000,000 = 1$).

Folgendes Event wird emitted:

```solidity
event PoolLaunched(address poolAddress, string name, address governanceTokenAddress, string governanceTokenName, uint256 entryBarrier)
```

### 2. Join Pool

**CONTRACT: WunderPool**

```solidity
function joinForUser(uint256 amount, address user)
```

Fügt den `user` dem WunderPool mit dem entsprechenden `amount` hinzu, wenn dieser auf der WhiteList ist. Der `amount` ist in USDC (1,000,000 = 1$).
Es ist zu beachten, dass der User vor dem Beitreten, den entsprechenden USDC amount approven muss.

Folgendes Event wird emitted:

```solidity
event NewMember(address memberAddress, uint256 stake)
```

### 3. Invite User

**CONTRACT: WunderPool**

```solidity
function addToWhiteListForUser(address user, address newMember, bytes signature)
```

Fügt ein `newMember` zur WhiteList des WunderPools hinzu, wodurch er beitreten kann.
Die `user` Adresse ist die des Einladenden Users, der ein Pool Mitglied sein muss.
Die Signatur setzt sich zusammen aus:

```
sign(user, WunderPoolAddress, newMember)
```

### 4. Create Proposal

**CONTRACT: WunderPool**

```solidity
function createProposalForUser(address user, string title, string description, address[] contractAddresses, string[] actions, bytes[] params, uint256[] transactionValues, uint256 deadline, bytes signature)
```

Erstellt ein neues Proposal.
Die `user` Adresse ist die des Erstellers, der ein Pool Mitglied sein muss.
Vor dem Signieren muss erst die nächste ProposalId ermittelt werden, die mit signiert werden muss:

```solidity
function getAllProposalIds() returns(uint[] proposalIds)
```

Die Länge des `proposalIds` Array ist die nächste ProposalId.

Die Signatur setzt sich zusammen aus:

```
sign(user, WunderPoolAddress, title, description, contractAddresses, actions, params, transactionValues, deadline, proposalId)
```

Folgendes Event wird emitted:

```solidity
event NewProposal(uint256 id, address creator, string title)
```

### 5. Vote

**CONTRACT: WunderPool**

```solidity
function voteForUser(address user, uint256 proposalId, uint256 mode, bytes signature)
```

Stimmt über ein Proposal ab.
Die `user` Adresse ist die des Voters, der ein Pool Mitglied sein muss.
Der `mode` kann 1 (YES) oder 2 (NO) sein.

Die Signatur setzt sich zusammen aus:

```
sign(user, WunderPoolAddress, proposalId, mode)
```

Folgendes Event wird emitted:

```solidity
event Voted(uint256 proposalId, address voter, uint256 mode)
```

### 6. Execute Proposal

**CONTRACT: WunderPool**

```solidity
function executeProposal(uint256 proposalId)
```

Führt ein Proposal aus, wenn es ausführbar ist.

**_Da diese Funktion öffentlich ist, kann sie von jeder Person ausgeführt werden. Hier könnte man überlegen, der Ausführenden Person eine kleine Provision auszuzahlen, um Leute zu inzentivieren, regelmäßig Proposals auszuführen. So wäre praktisch garantiert, dass Proposals sofort ausgeführt werden, sobald die Bedingungen zur Ausführung erfüllt sind._**

Folgendes Event wird emitted:

```solidity
event ProposalExecuted(uint256 proposalId, address executor, bytes[] result)
```

## Informationen über Pools, Proposals etc.

**Seit der Delta Version ist die Proposal-Logik in einem neuen Contract, dem WunderProposal Contract.**

### WunderProposal Contract

Die `pool` Adresse in allen folgenden Funktionen ist die Adresse des WunderPools, für den man die Informationen haben möchte.

#### Get Proposal Count

```solidity
function getProposalCount(address pool) returns (uint256 proposalCount)
```

Gibt die Anzahl an Proposals für einen Pool aus.

#### Get Proposal

```solidity
function getProposal(address pool, uint256 proposalId) returns (string title, string description, uint256 transactionCount, uint256 deadline, uint256 yesVotes, uint256 noVotes, uint256 totalVotes, uint256 createdAt, bool executed)
```

Gibt Informationen über ein Proposal aus.

#### Get Proposal Transaction

```solidity
function getProposalTransaction(address pool, uint256 proposalId, uint256 transactionIndex) returns (string action, bytes param, uint256 transactionValue, address contractAddress)
```

Gibt Informationen über die Transaktionen eines Proposals aus.

#### Is Proposal Executable

```solidity
function proposalExecutable(address pool, uint256 proposalId) returns (bool executable, string errorMessage)
```

Gibt aus, ob ein Proposal bereit ist, ausgeführt zu werden. Liefert außerdem einen Grund (`errorMessage`), falls es noch nicht ausgeführt werden kann.

#### Calculate Votes

```solidity
function calculateVotes(address pool, uint256 proposalId) returns (uint256 yesVotes, uint256 noVotes)
```

Gibt die Ja und Nein Stimmen eines Proposals basierend auf der Anzahl der GovernanceTokens aus.

#### User has voted

```solidity
function hasVoted(address pool, uint256 proposalId, address account) returns (VoteType)
```

Gibt aus, wofür ein User für ein bestimmtes Proposal abgestimmt hat: 0 => Nicht Abgestimmt, 1 => Ja, 2 => Nein

### PoolLauncher Contract

#### All Pools

```solidity
function allPools() public view returns (address[])
```

Gibt alle deployten Pool Contract Adresses aus.

#### Pools of one User

```solidity
function poolsOfMember(address member) returns (address[])
```

Gibt alle Pool Adressen aus, in denen ein `member` Mitglied ist.

#### Pools a User is White Listed in

```solidity
function whiteListedPoolsOfMember(address member) returns (address[])
```

Gibt alle Pool Adressen aus, in denen ein `member` gewhitelisted ist, also denen er beitreten kann.

### WunderPool Contract

#### Members of a Pool

```solidity
function poolMembers() public view returns (address[]) {
```

Gibt die Adressen aller Pool Mitglieder aus.

#### User is Member

```solidity
function isMember(address maybeMember) public view returns (bool) {
```

Gibt aus, ob ein `maybeMember` Mitglied in einem Pool ist.

#### User is White Listed

```solidity
function isWhiteListed(address user) public view returns (bool) {
```

Gibt aus, ob ein `user` eingeladen ist, dem Pool beizutreten.

#### All Proposal Ids

```solidity
function getAllProposalIds() public view returns (uint256[]) {
```

Gibt ein Array aller proposalIds aus.
