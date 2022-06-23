# Relevante Funktionen der Pool Contracts

Dies ist die Dokumentation für die WunderPool Smart Contracts.
Die Addressen der Contracts sind [hier](https://github.com/WunderPass/SmartContract-WunderPool/blob/master/README.md) aufgelistet.

## Signieren

Einige Fuktionen (z.B. `voteForUser()`) benötigen eine Signatur als Parameter. In Solidity gibt es zwei Möglichkeiten, Signaturen zu überprüfen: `abi.encode()` und `abi.encodePacked()`. Da `abi.encodePacked()` nicht mit string[] oder byte[] funktioniert, musste bei `createProposalForUser()` auf `abi.encode()` zurückgegriffen werden. In dieser Dokumentation wird unterschieden zwischen `sign()` und `signPacked()`.

### Javascript (ethers.js)

In JavaScript kann `sign()` und `signPacked()` mit der folgenden Funktion ausgeführt werden:

```js
async function signMessage(signer, types, params, packed = true) {
  let message;
  if (packed) {
    // signPacked()
    message = ethers.utils.solidityKeccak256(types, params);
  } else {
    // sign()
    message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(types, params)
    );
  }
  const bytes = ethers.utils.arrayify(message);
  return await signer.signMessage(bytes);
}
```

## User Journey

### 1. Create Pool

**CONTRACT: PoolLauncher**

```solidity
function createNewPool(string poolName, string tokenName, string tokenSymbol, uint256 amount, address creator, address[] members, uint256 minInvest, uint256 maxInvest, uint256 maxMembers, uint8 votingThreshold, uint256 votingTime, uint256 minYesVoters)
```

Erstellt einen neuen WunderPool Contract und einen neuen PoolGovernanceToken Contract mit der entsprechenden Konfiguration.
Außerdem werden dem `creator` 100 GovernanceTokens gutgeschrieben, er wird Mitglied des Pools und die in `amount` spezifizierte Anzahl an USDC (1,000,000 = 1$) werden vom `creator` an den Pool überwiesen.

Die Adressen des `members` Arrays werden bei der Erstellung schon gewhitelisted.

Im Gegensatz zum Delta Contract, können jetzt mehr Konfigurationsparameter übergeben werden:

| Param             | Erklärung                                                                         |
| ----------------- | --------------------------------------------------------------------------------- |
| `minInvest`       | Der Minimale Einsatz                                                              |
| `maxInvest`       | Der Maximale Einsatz                                                              |
| `maxMembers`      | Maximale Anzahl an Mitgliedern                                                    |
| `votingThreshold` | Minimale Ja-Stimmen in Prozent (0-100), damit ein Proposal ausgeführt werden kann |
| `votingTime`      | Zeit, die die Mitglieder zum Abstimmen haben                                      |
| `minYesVoters`    | Minimale Anzahl an Mitgliedern, die Ja stimmen müssen                             |

Folgendes Event wird emitted:

```solidity
event PoolLaunched(address poolAddress, string name, address governanceTokenAddress)
```

### 2. Join Pool

**CONTRACT: WunderPool**

```solidity
function joinForUser(uint256 amount, address user, string secret)
```

Fügt den `user` dem WunderPool mit dem entsprechenden `amount` hinzu, wenn dieser auf der WhiteList ist. Der `amount` ist in USDC (1,000,000 = 1$).
Es ist zu beachten, dass der User vor dem Beitreten, den entsprechenden USDC amount approven muss.

Seit der Epsilon Version ist es jetzt zudem möglich, mithilfe eines `secret` zu joinen. Dies ist besonders sinnvoll, wenn der eingeladene `user` zum Zeitpunkt der Einladung noch keine Adresse hatte, wodurch ein klassisches whitelisten der Adresse nicht möglich ist.

Folgendes Event wird emitted:

```solidity
event NewMember(address memberAddress, uint256 stake)
```

### 3. Invite User

**CONTRACT: WunderPool**

#### 3.1 Invite With Address

```solidity
function addToWhiteListForUser(address user, address newMember, bytes signature)
```

Fügt ein `newMember` zur WhiteList des WunderPools hinzu, wodurch er beitreten kann.
Die `user` Adresse ist die des Einladenden Users, der ein Pool Mitglied sein muss.
Die Signatur setzt sich zusammen aus:

```
signPacked(user, WunderPoolAddress, newMember)
```

#### 3.2 Invite With Secret

```solidity
function addToWhiteListWithSecret(address user, bytes32 hashedSecret, uint256 validForCount, bytes signature)
```

Registriert ein `hashedSecret` als eine art Passwort für den Pool. Dieses ist `validForCount` mal gültig.
Die `user` Adresse ist die des Einladenden Users, der ein Pool Mitglied sein muss.
Das `hashedSecret` wird mithilfe von `keccak256` durch einen zufälligen string generiert, der in der `joinForUser` Funktion als Parameter übergeben werden kann.

```js
const secret = 'GEHEIM';
const hashedSecret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret));
```

Die Signatur setzt sich zusammen aus:

```
signPacked(user, WunderPoolAddress, hashedSecret, validForCount)
```

### 4. Create Proposal

**CONTRACT: WunderPool**

```solidity
function createProposalForUser(address user, string title, string description, address[] contractAddresses, string[] actions, bytes[] params, uint256[] transactionValues, bytes signature)
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
sign(user, WunderPoolAddress, title, description, contractAddresses, actions, params, transactionValues, proposalId)
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
signPacked(user, WunderPoolAddress, proposalId, mode)
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

### 7. Create Join Proposal

**CONTRACT: WunderPool**

```solidity
function createJoinProposal(address user, string title, string description, uint256 amount, uint256 govTokens)
```

Erstellt ein Proposal zum Beitreten eines Pools nachdem dieser bereits geschlossen ist.
Die `user` Adresse ist diejenige, welche eintreten möchte. Der `amount` in USDC, die eingezahlt werden und die Anzahl an `govTokens`, die der `user` für seinen Einsatz bekommt, können frei gewählt werden, dennoch sollte im Frontend/Backend vorher eine faire Einschätzung erfolgen.

Folgendes Event wird emitted:

```solidity
event NewProposal(uint256 id, address creator, string title)
```

### 8. Delegate Votes

**CONTRACT: PoolGovernanceTokens**

```solidity
function delegateForUser(address user, address to, bytes signature)
```

Tritt die Stimmrechte eines `user`s an eine andere Person (`to`) ab.
Vor dem Signieren muss erst die nächste nonce ermittelt werden, die mit signiert werden muss:

```solidity
function nonces(address user) returns(uint)
```

Die Signatur setzt sich zusammen aus:

```
signPacked(user, PoolGovernanceTokenAddress, to, nonce)
```

### 9. Revoke Votes

**CONTRACT: PoolGovernanceTokens**

```solidity
function revokeForUser(address user, bytes signature)
```

Gibt einem `user` seine abgetretenden Stimmrechte zurück.
Vor dem Signieren muss erst die nächste nonce ermittelt werden, die mit signiert werden muss:

```solidity
function nonces(address user) returns(uint)
```

Die Signatur setzt sich zusammen aus:

```
signPacked(user, PoolGovernanceTokenAddress, nonce)
```

## Informationen über Pools, Proposals etc.

**Seit der Delta Version ist die Proposal-Logik in einem neuen Contract, dem WunderProposal Contract.**
**Seit der Epsilon Version ist die Konfigurations-Logik in einem neuen Contract, dem PoolConfig Contract.**

### WunderProposal Contract

Die `pool` Adresse in allen folgenden Funktionen ist die Adresse des WunderPools, für den man die Informationen haben möchte.

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
function calculateVotes(address pool, uint256 proposalId) returns (uint256 yesVotes, uint256 noVotes, uint256 yesVoters, uint256 noVoters)
```

Gibt die Ja und Nein Stimmen eines Proposals basierend auf der Anzahl der GovernanceTokens, sowie die Anzahl an Mitgliedern die Ja bzw. Nein gestimmt haben aus.

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

#### Name of the Pool

```solidity
function name() returns(string)
```

Gibt den Namen des Pools aus.

#### Pool is closed?

```solidity
function poolClosed() returns(bool)
```

Gibt aus, ob der Beitritt in den Pool noch möglich ist. Wird `false`, sobald das erste Proposal ausgeführt wurde.

#### Members of a Pool

```solidity
function poolMembers() public view returns (address[])
```

Gibt die Adressen aller Pool Mitglieder aus.

#### User is Member

```solidity
function isMember(address maybeMember) public view returns (bool)
```

Gibt aus, ob ein `maybeMember` Mitglied in einem Pool ist.

#### User is White Listed

```solidity
function isWhiteListed(address user) public view returns (bool)
```

Gibt aus, ob ein `user` eingeladen ist, dem Pool beizutreten.

#### Invest of User

```solidity
function investOfUser(address user) public view returns (uint)
```

Gibt aus, wie viel USDC ein `user` insgesamt investiert hat.

#### All Proposal Ids

```solidity
function getAllProposalIds() public view returns (uint256[])
```

Gibt ein Array aller proposalIds aus.

#### All Owned Token Addresses

```solidity
function getOwnedTokenAddresses() public view returns (address[])
```

Gibt ein Array aller ERC20 Tokens aus, die der Pool besitzt.

#### All Owned NFT Addresses

```solidity
function getOwnedNftAddresses() public view returns (address[])
```

Gibt ein Array aller ERC721 Tokens aus, die der Pool besitzt.

#### All Owned NFT Token IDs

```solidity
function getOwnedNftTokenIds(address contractAddress) public view returns (uint256[])
```

Gibt ein Array aller Token IDs eines ERC721 Tokens aus, die der Pool besitzt.

#### GovernanceTokens of a user

```solidity
function governanceTokensOf(address user) public view returns(uint256 balance)
```

Gibt die Anzahl an GovernanceTokens eines Users zurück.

#### Total GovernanceTokens

```solidity
function totalGovernanceTokens() public view returns (uint256 balance)
```

Gibt den total Supply an GovernanceTokens zurück.

#### GovernanceToken Price

```solidity
function governanceTokenPrice() public view returns (uint256 price)
```

Gibt den Preis eines GovernanceTokens zurück.

### PoolConfig Contract

Die `pool` Adresse in allen folgenden Funktionen ist die Adresse des WunderPools, für den man die Informationen haben möchte.

#### Gesamte Pool Konfiguration

```solidity
function getConfig(address pool) public view returns (uint256 minInvest, uint256 maxInvest, uint256 maxMembers, uint8 votingThreshold, uint256 votingTime, uint256 minYesVoters)
```

Gibt die gesamte Pool Konfiguration aus.

#### Minimum Invest

```solidity
function minInvest(address pool) public view returns (uint256)
```

Gibt den Minimum Invest eines Pools aus.

#### Maximum Invest

```solidity
function maxInvest(address pool) public view returns (uint256)
```

Gibt den Maximum Invest eines Pools aus.

#### Maximale Member

```solidity
function maxMembers(address pool) public view returns (uint256)
```

Gibt die maximal mögliche Anzahl an Membern eines Pools aus.

#### Voting Threshold

```solidity
function votingThreshold(address pool) public view returns (uint8)
```

Gibt den Voting Threshold in % eines Pools aus.

#### Voting Time

```solidity
function votingTime(address pool) public view returns (uint256)
```

Gibt die Zeitspanne für neue Proposals eines Pools aus.

#### Minimum Yes Voters

```solidity
function minYesVoters(address pool) public view returns (uint256)
```

Gibt die minimale Anzahl an Yes Votern eines Pools aus.

#### Member can Join

```solidity
function memberCanJoin(address pool, uint256 amount, uint256 invested, uint256 tokenPrice, uint256 members) public view returns (bool, string memory)
```

Gibt aus, ob ein User einem Pool joinen kann (mit Fehlermeldung).
