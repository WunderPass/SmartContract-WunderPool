// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ERC20Interface {
  function name() external view returns(string memory);
  function symbol() external view returns(string memory);
  function balanceOf(address account) external view returns (uint256);
  function totalSupply() external view returns (uint256);
  function transfer(address, uint) external returns (bool);
}

interface IPoolGovernanceTokenBeta {
  function issue(address, uint) external;
  function destroy() external;
  function price() external view returns(uint);
}

contract WunderVaultBeta {
  address[] public ownedTokenAddresses;
  address public governanceToken;
  address internal quickSwapRouterAddress = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;
  
  event TokenAdded(address indexed tokenAddress, uint balance);
  event MaticWithdrawed(address indexed receiver, uint amount);
  event TokensWithdrawed(address indexed tokenAddress, address indexed receiver, uint amount);

  modifier onlyPool {
    require(msg.sender == address(this), "Only the Pool is allowed to execute this function. Try submitting a proposal");
    _;
  }

  constructor(address _tokenAddress) {
    governanceToken = _tokenAddress;
  }
  
  function addToken(address _tokenAddress) public {
    (, bytes memory nameData) = _tokenAddress.call(abi.encodeWithSignature("name()"));
    (, bytes memory symbolData) = _tokenAddress.call(abi.encodeWithSignature("symbol()"));
    (, bytes memory balanceData) = _tokenAddress.call(abi.encodeWithSignature("balanceOf(address)", address(this)));

    require(nameData.length > 0, "Not a valid ERC20 Token");
    require(symbolData.length > 0, "Not a valid ERC20 Token");
    require(balanceData.length > 0, "Not a valid ERC20 Token");

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
  
  function _distributeSomeBalanceOfTokenEvenly(address _tokenAddress, address[] memory _receivers, uint _amount) public onlyPool {
    for (uint256 index = 0; index < _receivers.length; index++) {
      _withdrawTokens(_tokenAddress, _receivers[index], _amount * governanceTokensOf(_receivers[index]) / totalGovernanceTokens());
    }
  }

  function _distributeFullBalanceOfTokenEvenly(address _tokenAddress, address[] memory _receivers) public onlyPool {
    uint balance = ERC20Interface(_tokenAddress).balanceOf(address(this));

    _distributeSomeBalanceOfTokenEvenly(_tokenAddress, _receivers, balance);
  }

  function _distributeFullBalanceOfAllTokensEvenly(address[] memory _receivers) public onlyPool {
    for (uint256 index = 0; index < ownedTokenAddresses.length; index++) {
      _distributeFullBalanceOfTokenEvenly(ownedTokenAddresses[index], _receivers);
    }
  }

  function _distributeMaticEvenly(address[] memory _receivers, uint _amount) public onlyPool {
    for (uint256 index = 0; index < _receivers.length; index++) {
      _withdrawMatic(_receivers[index], _amount * governanceTokensOf(_receivers[index]) / totalGovernanceTokens());
    }
  }

  function _distributeAllMaticEvenly(address[] memory _receivers) public onlyPool {
    uint balance = address(this).balance;
    _distributeMaticEvenly(_receivers, balance);
  }

  function _withdrawTokens(address _tokenAddress, address _receiver, uint _amount) public onlyPool {
    uint balance = ERC20Interface(_tokenAddress).balanceOf(address(this));
    require(balance >= _amount, "Withdraw Amount exceeds balance of Vault");
    require(ERC20Interface(_tokenAddress).transfer(_receiver, _amount), "Withdraw Failed");
    emit TokensWithdrawed(_tokenAddress, _receiver, _amount);
  }

  function _withdrawMatic(address _receiver, uint _amount) public onlyPool {
    require(address(this).balance >= _amount, "Withdraw Amount exceeds balance of Vault");
    payable(_receiver).transfer(_amount);
    emit MaticWithdrawed(_receiver, _amount);
  }

  function _issueGovernanceTokens(address _newUser, uint _value) internal {
    if (governanceTokenPrice() == 0) {
      IPoolGovernanceTokenBeta(governanceToken).issue(_newUser, 100);
    } else {
      IPoolGovernanceTokenBeta(governanceToken).issue(_newUser, _value / governanceTokenPrice());
    }
  }

  function governanceTokensOf(address _user) public view returns(uint balance) {
    return ERC20Interface(governanceToken).balanceOf(_user);
  }

  function totalGovernanceTokens() public view returns(uint balance) {
    return ERC20Interface(governanceToken).totalSupply();
  }

  function governanceTokenPrice() public view returns(uint price) {
    return IPoolGovernanceTokenBeta(governanceToken).price();
  }

  function _destroyGovernanceToken() internal {
    IPoolGovernanceTokenBeta(governanceToken).destroy();
  }
}