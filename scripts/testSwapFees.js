const toMatic = (str) => {
  str = typeof(str) == 'string' ? str : `${str}`;
  return ethers.utils.parseEther(str);
};

const precision = (str, decimals) => {
  return Math.round(Number(str) * (10 ** decimals)) / (10 ** decimals)
};

function Balance(state, matic, usdt, token) {
  this.state = state;
  this.matic = ethers.utils.formatEther(matic);
  this.usdt = ethers.utils.formatUnits(usdt, 6);
  this.token = ethers.utils.formatEther(token);
}

let usdt, matic, token, state;

async function main() {
  const investAmount = 10;
  const [user] = await ethers.getSigners();
  const initialBalance = await user.getBalance();
  
  const USDT = await ethers.getContractAt("TestToken", '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', user);
  const TOKEN = await ethers.getContractAt("TestToken", '0xE06Bd4F5aAc8D0aA337D13eC88dB6defC6eAEefE', user);
  const swapper = await ethers.getContractAt("WunderSwapperBeta", '0xbD4b2807dDaBF2bCb7A8555D98861A958c11435b', user);

  state = "Initial State"
  matic = await user.getBalance();
  usdt = await USDT.balanceOf(user.address);
  token = await TOKEN.balanceOf(user.address);
  const first = new Balance(state, matic, usdt, token);

  await swapper.buyTokens(USDT.address, {value: toMatic(investAmount)})
  state = "After BuyTokens"
  matic = await user.getBalance();
  usdt = await USDT.balanceOf(user.address);
  token = await TOKEN.balanceOf(user.address);
  const second = new Balance(state, matic, usdt, token);

  await USDT.transfer(swapper.address, usdt);
  await swapper.swapTokens(USDT.address, TOKEN.address, usdt)
  state = "After SwapTokens"
  matic = await user.getBalance();
  usdt = await USDT.balanceOf(user.address);
  token = await TOKEN.balanceOf(user.address);
  const third = new Balance(state, matic, usdt, token);

  await TOKEN.transfer(swapper.address, token);
  await swapper.swapTokens(TOKEN.address, USDT.address, token)
  state = "After SwapBack"
  matic = await user.getBalance();
  usdt = await USDT.balanceOf(user.address);
  token = await TOKEN.balanceOf(user.address);
  const fourth = new Balance(state, matic, usdt, token);

  await USDT.transfer(swapper.address, usdt);
  await swapper.sellTokens(USDT.address, usdt)
  state = "After SellTokens"
  matic = await user.getBalance();
  usdt = await USDT.balanceOf(user.address);
  token = await TOKEN.balanceOf(user.address);
  const fifth = new Balance(state, matic, usdt, token);

  console.table([first, second, third, fourth, fifth])
  const delta = initialBalance.sub(matic);
  console.log(`Fees: ${precision(ethers.utils.formatEther(delta), 3)} MATIC`)
  console.log(`Fees Per Trade: ${precision(ethers.utils.formatEther(delta.div(4)), 3)} MATIC`)
  console.log(`Fees Per Trade (%): ${(delta.div(4).mul(100000).div(toMatic(investAmount)).toNumber()) / 1000} %`)
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
