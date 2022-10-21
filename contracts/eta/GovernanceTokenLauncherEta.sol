// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./PoolGovernanceTokenEta.sol";

contract GovernanceTokenLauncherEta {
    address public owner;
    address[] public allowedSpenders;

    constructor(address[] memory _distributors) {
        owner = msg.sender;
        allowedSpenders = _distributors;
    }

    function canTransfer(address _spender) public view returns (bool) {
        for (uint256 index = 0; index < allowedSpenders.length; index++) {
            if (_spender == allowedSpenders[index]) return true;
        }
        return false;
    }

    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _amount,
        address _creator
    ) public returns (address) {
        PoolGovernanceTokenEta newToken = new PoolGovernanceTokenEta(
            _name,
            _symbol,
            _amount,
            _creator,
            msg.sender
        );
        return address(newToken);
    }

    function addAllowedSpender(address _spender) public {
        require(msg.sender == owner, "NOT ALLOWED");
        allowedSpenders.push(_spender);
    }
}
