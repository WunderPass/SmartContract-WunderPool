//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ERC20 {
    function allowance(address owner, address spender)
        external
        view
        returns (uint256);

    function balanceOf(address owner) external view returns (uint256);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    function transfer(address recipient, uint256 amount)
        external
        returns (bool);
}

contract WunderDistributorBeta {
    uint256 public currentEventId = 0;
    uint256 public currentGameId = 0;

    uint256[] internal _closedEvents;
    uint256[] internal _closedGames;

    enum PayoutRule {
        WinnerTakesAll,
        Proportional
    }

    enum EventType {
        Soccer
    }

    struct Event {
        uint256 id;
        string name;
        uint256 startDate;
        uint256 endDate;
        uint8 eventType;
        address owner;
        bool resolved;
        uint256[] outcome;
    }

    struct Game {
        uint256 id;
        string name;
        uint256 stake;
        address tokenAddress;
        bool closed;
        uint256 eventId;
        uint8 payoutRule;
        bool checkApproval;
        Participant[] participants;
    }

    struct Participant {
        address addr;
        uint256[] prediction;
    }

    mapping(uint256 => Event) events;
    mapping(uint256 => Game) games;
    mapping(uint256 => mapping(address => bool)) gameParticipants;
    /**
     * @notice Stores reserved Amounts depending on userAddress, tokenAddress and a boolean
     * The boolean controls whether the reserved amount is of type Approval (true) or Ownership (false):
     * Approval checks wheter the user has approved enough tokens
     * Ownership checks wheter the user owns enough tokens
     */
    mapping(address => mapping(address => mapping(bool => uint256))) reservedAmount;

    event NewEvent(uint256 indexed id, string name, uint256 endDate);
    event NewGame(uint256 indexed id, string name, uint256 eventId);
    event NewParticipant(
        uint256 indexed eventId,
        uint256 indexed gameId,
        address addr
    );
    event GameClosed(uint256 indexed gameId);

    /**
     * @notice Registers a new Event
     * @param _name: Name of the Event.
     * @param _endDate: The Time at which the Event outcome can be resolved.
     * @param _eventType: The type of the Event (choose one of enum EventType).
     */
    function registerEvent(
        string calldata _name,
        uint256 _startDate,
        uint256 _endDate,
        uint8 _eventType
    ) public {
        Event storage newEvent = events[currentEventId];
        newEvent.id = currentEventId;
        newEvent.name = _name;
        newEvent.startDate = _startDate;
        newEvent.endDate = _endDate;
        newEvent.eventType = _eventType;
        newEvent.owner = msg.sender;

        emit NewEvent(currentEventId, _name, _endDate);
        currentEventId++;
    }

    /**
     * @notice Registers a new Game
     * @param _name: Name of the Game.
     * @param _stake: The Amount of Tokens, every Player puts into the price pool.
     * @param _tokenAddress: The Address of the Token, every Player puts into the price pool.
     * @param _eventId: The ID of the Event (choose an existing Event or register one).
     * @param _payoutRule: The PayoutRule of the Game (choose one of enum PayoutRule).
     * @param _checkApproval: When used with Casama (casama.io), set to false to avoid approval checking as this contract is approved for all GovernanceTokens.
     */
    function registerGame(
        string calldata _name,
        uint256 _stake,
        address _tokenAddress,
        uint256 _eventId,
        uint8 _payoutRule,
        bool _checkApproval
    ) public {
        require(_eventId == events[_eventId].id, "500: Event does not exist");
        Game storage newGame = games[currentGameId];
        newGame.id = currentGameId;
        newGame.name = _name;
        newGame.stake = _stake;
        newGame.tokenAddress = _tokenAddress;
        newGame.eventId = _eventId;
        newGame.payoutRule = _payoutRule;
        newGame.checkApproval = _checkApproval;

        emit NewGame(currentGameId, _name, _eventId);
        currentGameId++;
    }

    /**
     * @notice Gets an Event.
     * @param _id: The ID of the Event you want to retreive.
     */
    function getEvent(uint256 _id) public view returns (Event memory) {
        return events[_id];
    }

    /**
     * @notice Gets a Game.
     * @param _id: The ID of the Game you want to retreive.
     */
    function getGame(uint256 _id) public view returns (Game memory) {
        return games[_id];
    }

    /**
     * @notice Returns an Array of all Events that have been resolved.
     * This can be used to quickly identify Events that are waiting for their outcome.
     */
    function closedEvents() public view returns (uint256[] memory) {
        return _closedEvents;
    }

    /**
     * @notice Returns an Array of all Games that have been closed.
     * This can be used to quickly identify Games that are waiting to be closed.
     */
    function closedGames() public view returns (uint256[] memory) {
        return _closedGames;
    }

    /**
     * @notice Registers a new Participant for a Game With Signature
     * @param _id: The ID of the Game to add the Participant to.
     * @param _prediction: The Participants prediction, as to how the Event will resolve.
     * @param _participant: The Address of the Participant.
     * @param _signature: The Signature (_id, address(this), _prediction).
     */
    function registerParticipantForUser(
        uint256 _id,
        uint256[] memory _prediction,
        address _participant,
        bytes memory _signature
    ) public {
        bytes32 message = prefixed(
            keccak256(abi.encodePacked(_id, address(this), _prediction))
        );

        reqSig(message, _signature, _participant);
        _registerParticipant(_id, _participant, _prediction);
    }

    /**
     * @notice Registers a new Participant for a Game
     * @param _id: The ID of the Game to add the Participant to.
     * @param _prediction: The Participants prediction, as to how the Event will resolve.
     */
    function registerParticipant(uint256 _id, uint256[] memory _prediction)
        public
    {
        _registerParticipant(_id, msg.sender, _prediction);
    }

    /**
     * @notice Internal Function called by registerParticipant and registerParticipantForUser
     */
    function _registerParticipant(
        uint256 _id,
        address _participant,
        uint256[] memory _prediction
    ) internal {
        Game storage game = games[_id];
        Event memory e = events[game.eventId];
        require(
            !gameParticipants[_id][_participant],
            "501: Already Participant"
        );
        require(e.startDate >= block.timestamp, "502: Betting Phase Expired");
        reservedAmount[_participant][game.tokenAddress][
            game.checkApproval
        ] += game.stake;
        if (game.checkApproval) {
            reqHasApproved(_participant, game.tokenAddress);
        } else {
            reqOwnsToken(_participant, game.tokenAddress);
        }
        game.participants.push(Participant(_participant, _prediction));
        gameParticipants[_id][_participant] = true;
        emit NewParticipant(game.eventId, _id, _participant);
    }

    /**
     * @notice Resolves the Outcome of an Event. Can only be called by the Event's creator
     * @param _id: The ID of the Event to resolve.
     * @param _outcome: The Outcome of the Event.
     */
    function setEventOutcome(uint256 _id, uint256[] memory _outcome) public {
        Event storage e = events[_id];
        require(msg.sender == e.owner, "503: Not allowed");
        require(!e.resolved, "505: Event already resolved");
        e.outcome = _outcome;
        e.resolved = true;
        _closedEvents.push(_id);
    }

    /**
     * @notice Settles a Game. Can only be called once for every Game and only if the Event has been resolved
     * @param _id: The ID of the Game to settle.
     */
    function determineGame(uint256 _id) public {
        Game storage game = games[_id];
        Event memory e = events[game.eventId];
        require(e.resolved, "506: Event not yet resolved");
        require(!game.closed, "507: Game already closed");

        if (game.participants.length > 0) {
            uint256[] memory points = calculatePoints(
                e.eventType,
                e.outcome,
                game.participants
            );
            distributeTokens(game, points, game.participants);
        }

        _closedGames.push(_id);
        game.closed = true;
        emit GameClosed(_id);
    }

    /**
     * @notice This Function should be called, if determineGame fails and you want to reset the reserved amounts
     * The rationale here is, that someone in the Game could decrese their allowance, hence making it impossible to settle the Game.
     * In that case, the reserved amounts can be reduced by the stake of the game.
     * @param _id: The ID of the Game.
     */
    function clearReservedAmounts(uint256 _id) public {
        Game storage game = games[_id];
        Event memory e = events[game.eventId];
        require(msg.sender == e.owner, "503: Not allowed");
        require(e.resolved, "506: Event not yet resolved");
        require(!game.closed, "507: Game already closed");

        for (uint256 index = 0; index < game.participants.length; index++) {
            reservedAmount[game.participants[index].addr][game.tokenAddress][
                game.checkApproval
            ] -= game.stake;
        }
        _closedGames.push(_id);
        game.closed = true;
        emit GameClosed(_id);
    }

    /**
     * @notice Internal Function called by determineGame.
     * This function calculates the points, every Participant in the Game scored based on the eventType and the Event's outcome.
     */
    function calculatePoints(
        uint8 _eventType,
        uint256[] memory _outcome,
        Participant[] memory _participants
    ) internal pure returns (uint256[] memory points) {
        points = new uint256[](_participants.length);
        if (_eventType == uint8(EventType.Soccer)) {
            int256 diff = int256(_outcome[0]) - int256(_outcome[1]);
            uint256 winner = _outcome[0] > _outcome[1]
                ? 0
                : _outcome[1] > _outcome[0]
                ? 1
                : 2;
            for (uint256 index = 0; index < _participants.length; index++) {
                uint256[] memory prediction = _participants[index].prediction;
                int256 participantDiff = int256(prediction[0]) -
                    int256(prediction[1]);
                uint256 participantWinner = prediction[0] > prediction[1]
                    ? 0
                    : prediction[1] > prediction[0]
                    ? 1
                    : 2;

                if (
                    prediction[0] == _outcome[0] && prediction[1] == _outcome[1]
                ) {
                    points[index] = 3;
                } else if (participantDiff == diff) {
                    points[index] = 2;
                } else if (participantWinner == winner) {
                    points[index] = 1;
                } else {
                    points[index] = 0;
                }
            }
        }
    }

    /**
     * @notice Internal Function called by determineGame.
     * This function calculates the Winners and distributes the Price Pool among them based on the payoutRule and the points determined in calculatePoints outcome.
     */
    function distributeTokens(
        Game memory game,
        uint256[] memory _points,
        Participant[] memory _participants
    ) internal {
        if (game.payoutRule == uint8(PayoutRule.WinnerTakesAll)) {
            uint256 highestScore = max(_points);
            uint256 winnerCount = 0;
            for (uint256 index = 0; index < _points.length; index++) {
                reservedAmount[_participants[index].addr][game.tokenAddress][
                    game.checkApproval
                ] -= game.stake;
                ERC20(game.tokenAddress).transferFrom(
                    _participants[index].addr,
                    address(this),
                    game.stake
                );
                if (_points[index] == highestScore) {
                    winnerCount++;
                }
            }

            uint256 priceMoney = (game.stake * _participants.length) /
                winnerCount;
            for (uint256 index = 0; index < _participants.length; index++) {
                if (_points[index] == highestScore) {
                    ERC20(game.tokenAddress).transfer(
                        _participants[index].addr,
                        priceMoney
                    );
                }
            }
        } else if (game.payoutRule == uint8(PayoutRule.Proportional)) {
            uint256 totalPoints = 0;
            for (uint256 index = 0; index < _points.length; index++) {
                totalPoints += _points[index];
                reservedAmount[_participants[index].addr][game.tokenAddress][
                    game.checkApproval
                ] -= game.stake;
                ERC20(game.tokenAddress).transferFrom(
                    _participants[index].addr,
                    address(this),
                    game.stake
                );
            }
            uint256 priceMoney = game.stake * _participants.length;
            for (uint256 index = 0; index < _participants.length; index++) {
                ERC20(game.tokenAddress).transfer(
                    _participants[index].addr,
                    totalPoints == 0
                        ? game.stake
                        : (priceMoney * _points[index]) / totalPoints
                );
            }
        }
    }

    /****************************************
     *          HELPER FUNCTIONS            *
     ****************************************/

    function reqHasApproved(address _user, address _token) internal view {
        require(
            ERC20(_token).allowance(_user, address(this)) >=
                reservedAmount[_user][_token][true],
            "508: Not approved"
        );
        reqOwnsToken(_user, _token);
    }

    function reqOwnsToken(address _user, address _token) internal view {
        require(
            ERC20(_token).balanceOf(_user) >=
                reservedAmount[_user][_token][true] +
                    reservedAmount[_user][_token][false],
            "509: Insufficient Balance"
        );
    }

    function max(uint256[] memory array)
        internal
        pure
        returns (uint256 maxValue)
    {
        maxValue = 0;
        for (uint256 index = 0; index < array.length; index++) {
            if (array[index] > maxValue) {
                maxValue = array[index];
            }
        }
    }

    function reqSig(
        bytes32 _msg,
        bytes memory _sig,
        address _usr
    ) internal pure {
        require(recoverSigner(_msg, _sig) == _usr, "207: Invalid Signature");
    }

    function splitSignature(bytes memory sig)
        internal
        pure
        returns (
            uint8 v,
            bytes32 r,
            bytes32 s
        )
    {
        require(sig.length == 65);

        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }

        return (v, r, s);
    }

    function recoverSigner(bytes32 message, bytes memory sig)
        internal
        pure
        returns (address)
    {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);

        return ecrecover(message, v, r, s);
    }

    function prefixed(bytes32 hash) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
            );
    }
}
