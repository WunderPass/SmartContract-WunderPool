// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

interface IERC20 {
  function transferFrom(address, address, uint256) external returns (bool);
}

contract TestNft is ERC721 {
  uint public maticPrice;
  uint public usdcPrice;
  uint public tokenId = 0;

  constructor(string memory name, string memory symbol, uint _maticPrice, uint _usdcPrice) ERC721(name, symbol) {
    maticPrice = _maticPrice;
    usdcPrice = _usdcPrice;
  }

  function mint() public payable {
    require(msg.value >= maticPrice, "Not enough MATIC");
    _mint(msg.sender, tokenId);
    tokenId += 1;
  }

  function mintUsd() public {
    require(IERC20(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174).transferFrom(msg.sender, address(this), usdcPrice), "USDC Transfer failed");
    _mint(msg.sender, tokenId);
    tokenId += 1;
  }
}