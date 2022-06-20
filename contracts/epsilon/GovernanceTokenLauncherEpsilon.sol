// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./PoolGovernanceTokenEpsilon.sol";

contract GovernanceTokenLauncherEpsilon {
    function createToken(
        string memory _name,
        string memory _symbol,
        uint256 _amount,
        address _creator
    ) public returns (address) {
        PoolGovernanceTokenEpsilon newToken = new PoolGovernanceTokenEpsilon(
            _name,
            _symbol,
            _amount,
            _creator,
            msg.sender
        );
        return address(newToken);
    }
}
