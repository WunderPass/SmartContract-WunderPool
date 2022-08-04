// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./PoolGovernanceTokenZeta.sol";

contract GovernanceTokenLauncherZeta {
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _amount,
        address _creator
    ) public returns (address) {
        PoolGovernanceTokenZeta newToken = new PoolGovernanceTokenZeta(
            _name,
            _symbol,
            _amount,
            _creator,
            msg.sender
        );
        return address(newToken);
    }
}
