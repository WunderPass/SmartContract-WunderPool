// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ERC20Interface {
  function balanceOf(address account) external view returns (uint256);
  function totalSupply() external view returns (uint256);
  function transfer(address, uint) external returns (bool);
  function transferFrom(address, address, uint256) external returns (bool);
}

interface IGovernanceToken {
  function issue(address, uint) external;
  function destroy() external;
  function price() external view returns(uint);
}

contract WunderVaultGamma {
  address public USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
  
  address public governanceToken;
  address internal quickSwapRouterAddress = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;
  
  address[] public ownedTokenAddresses;
  mapping(address => bool) public ownedTokenLookup;

  address[] public ownedNftAddresses;
  mapping(address => uint[]) ownedNftLookup;

  modifier onlyPool {
    require(msg.sender == address(this), "Not allowed. Try submitting a proposal");
    _;
  }

  event TokenAdded(address indexed tokenAddress, bool _isERC721, uint _tokenId);
  event MaticWithdrawed(address indexed receiver, uint amount);
  event TokensWithdrawed(address indexed tokenAddress, address indexed receiver, uint amount);

  constructor(address _tokenAddress) {
    governanceToken = _tokenAddress;
  }
  
  function addToken(address _tokenAddress, bool _isERC721, uint _tokenId) public {
    (, bytes memory nameData) = _tokenAddress.call(abi.encodeWithSignature("name()"));
    (, bytes memory symbolData) = _tokenAddress.call(abi.encodeWithSignature("symbol()"));
    (, bytes memory balanceData) = _tokenAddress.call(abi.encodeWithSignature("balanceOf(address)", address(this)));

    require(nameData.length > 0, "Invalid Token");
    require(symbolData.length > 0, "Invalid Token");
    require(balanceData.length > 0, "Invalid Token");

    if (_isERC721) {
      if (ownedNftLookup[_tokenAddress].length == 0) {
        ownedNftAddresses.push(_tokenAddress);
      }
      ownedNftLookup[_tokenAddress].push(_tokenId);
    } else if (!ownedTokenLookup[_tokenAddress]) {
      ownedTokenAddresses.push(_tokenAddress);
      ownedTokenLookup[_tokenAddress] = true;
    }
    emit TokenAdded(_tokenAddress, _isERC721, _tokenId);
  }

  function getOwnedTokenAddresses() public view returns(address[] memory) {
    return ownedTokenAddresses;
  }

  function getOwnedNftAddresses() public view returns(address[] memory) {
    return ownedNftAddresses;
  }

  function getOwnedNftTokenIds(address _contractAddress) public view returns(uint[] memory) {
    return ownedNftLookup[_contractAddress];
  }
  
  function _distributeNftsEvenly(address _tokenAddress, address[] memory _receivers) public onlyPool {
    for (uint256 i = 0; i < ownedNftLookup[_tokenAddress].length; i++) {
      uint sum = 0;
      uint randomNumber = uint256(keccak256(abi.encode(_tokenAddress, ownedNftLookup[_tokenAddress][i], block.timestamp))) % totalGovernanceTokens();
      for (uint256 j = 0; j < _receivers.length; j++) {
        sum += governanceTokensOf(_receivers[j]);
        if (sum >= randomNumber) {
          (bool success,) = _tokenAddress.call(abi.encodeWithSignature("safeTransferFrom(address,address,uint256)", address(this), _receivers[j], ownedNftLookup[_tokenAddress][i]));
          require(success, "Transfer failed");
          break;
        }
      }
    }
  }

  function _distributeAllNftsEvenly(address[] memory _receivers) public onlyPool {
    for (uint256 i = 0; i < ownedNftAddresses.length; i++) {
      _distributeNftsEvenly(ownedNftAddresses[i], _receivers);
    }
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
    if (_amount > 0) {
      uint balance = ERC20Interface(_tokenAddress).balanceOf(address(this));
      require(balance >= _amount, "Amount exceeds balance");
      require(ERC20Interface(_tokenAddress).transfer(_receiver, _amount), "Withdraw Failed");
      emit TokensWithdrawed(_tokenAddress, _receiver, _amount);
    }
  }

  function _withdrawMatic(address _receiver, uint _amount) public onlyPool {
    if (_amount > 0) {
      require(address(this).balance >= _amount, "Amount exceeds balance");
      payable(_receiver).transfer(_amount);
      emit MaticWithdrawed(_receiver, _amount);
    }
  }

  function _issueGovernanceTokens(address _newUser, uint _value) internal {
    if (governanceTokenPrice() == 0) {
      IGovernanceToken(governanceToken).issue(_newUser, 100);
    } else {
      IGovernanceToken(governanceToken).issue(_newUser, _value / governanceTokenPrice());
    }
  }

  function governanceTokensOf(address _user) public view returns(uint balance) {
    return ERC20Interface(governanceToken).balanceOf(_user);
  }

  function totalGovernanceTokens() public view returns(uint balance) {
    return ERC20Interface(governanceToken).totalSupply();
  }

  function governanceTokenPrice() public view returns(uint price) {
    return IGovernanceToken(governanceToken).price();
  }

  function _destroyGovernanceToken() internal {
    IGovernanceToken(governanceToken).destroy();
  }
}