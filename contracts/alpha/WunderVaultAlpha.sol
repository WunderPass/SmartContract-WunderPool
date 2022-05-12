// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

contract WunderVaultAlpha {
  address[] public ownedTokenAddresses;
  
  event TokenAdded(address indexed tokenAddress, uint balance);
  event MaticWithdrawed(address indexed receiver, uint amount);
  event TokensWithdrawed(address indexed tokenAddress, address indexed receiver, uint amount);

  function addToken(address _tokenAddress) public {
    (, bytes memory nameData) = _tokenAddress.call(abi.encodeWithSignature("name()"));
    (, bytes memory symbolData) = _tokenAddress.call(abi.encodeWithSignature("symbol()"));
    (, bytes memory balanceData) = _tokenAddress.call(abi.encodeWithSignature("balanceOf(address)", address(this)));

    require(nameData.length > 0, "Not a valid ERC20 Token: Token has no name() function");
    require(symbolData.length > 0, "Not a valid ERC20 Token: Token has no symbol() function");
    require(balanceData.length > 0, "Not a valid ERC20 Token: Token has no balanceOf() function");

    require(toUint256(balanceData) > 0, "Token will not be added: Token not owned by contract");
    ownedTokenAddresses.push(_tokenAddress);
    
    emit TokenAdded(_tokenAddress, toUint256(balanceData));
  }

  function toUint256(bytes memory _bytes) internal pure returns (uint256 value) {
    assembly {
      value := mload(add(_bytes, 0x20))
    }
  }

  function getOwnedTokenAddresses() public view returns(address[] memory) {
    return ownedTokenAddresses;
  }

  function _distributeAllTokensEvenly(address[] memory _receivers) internal {
    for (uint256 index = 0; index < ownedTokenAddresses.length; index++) {
      _distributeTokensEvenly(ownedTokenAddresses[index], _receivers);
    }
  }

  function _distributeTokensEvenly(address _tokenAddress, address[] memory _receivers) internal {
    (, bytes memory balanceBytes) = _tokenAddress.call(abi.encodeWithSignature("balanceOf(address)", address(this)));
    uint balance = toUint256(balanceBytes);

    for (uint256 index = 0; index < _receivers.length; index++) {
      _withdrawTokens(_tokenAddress, _receivers[index], balance / _receivers.length);
    }
  }

  function _distributeMaticEvenly(address[] memory _receivers) internal {
    uint balance = address(this).balance;

    for (uint256 index = 0; index < _receivers.length; index++) {
      _withdrawMatic(_receivers[index], balance / _receivers.length);
    }
  }

  function _withdrawTokens(address _tokenAddress, address _receiver, uint _amount) internal {
    (, bytes memory balance) = _tokenAddress.call(abi.encodeWithSignature("balanceOf(address)", address(this)));
    require(toUint256(balance) >= _amount, "Withdraw Amount exceeds balance of Vault");
    
    (bool success,) = _tokenAddress.call(abi.encodeWithSignature("transfer(address,uint256)", _receiver, _amount));
    require(success, "Withdraw Failed");
    emit TokensWithdrawed(_tokenAddress, _receiver, _amount);
  }

  function _withdrawMatic(address _receiver, uint _amount) internal {
    require(address(this).balance >= _amount, "Withdraw Amount exceeds balance of Vault");
    payable(_receiver).transfer(_amount);
    emit MaticWithdrawed(_receiver, _amount);
  }
}