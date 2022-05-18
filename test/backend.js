const { signMessage, topUp, approve, usdc, usdcBalance } = require('./helpers');

require('@nomiclabs/hardhat-waffle');

async function addToWhiteList(backend, signer, pool, user) {
  const userAddress = user?.address || user;

  const signature = await signMessage(
    signer,
    ['address', 'address', 'address'],
    [signer.address, pool.address, userAddress]
  );
  await pool
    .connect(backend)
    .addToWhiteListForUser(signer.address, userAddress, signature);
}

async function joinPool(backend, user, pool, amount) {
  await topUp(user, usdc(amount).mul(11).div(10));
  await approve(user, pool.address, usdc(amount));
  await pool.connect(backend).joinForUser(usdc(amount), user.address);
}

async function createProposal(
  backend,
  pool,
  signer,
  title,
  description,
  contractAddresses,
  actions,
  params
) {
  const transactionValues = new Array(contractAddresses.length).fill(0);
  const deadline = 1846183041;
  const nextProposalId = (await pool.getAllProposalIds()).length;

  const signature = await signMessage(
    signer,
    [
      'address',
      'address',
      'string',
      'string',
      'address[]',
      'string[]',
      'bytes[]',
      'uint256[]',
      'uint256',
      'uint256',
    ],
    [
      signer.address,
      pool.address,
      title,
      description,
      contractAddresses,
      actions,
      params,
      transactionValues,
      deadline,
      nextProposalId,
    ],
    false
  );

  await pool
    .connect(backend)
    .createProposalForUser(
      signer.address,
      title,
      description,
      contractAddresses,
      actions,
      params,
      transactionValues,
      deadline,
      signature
    );
}

async function createSwapProposal(
  backend,
  pool,
  signer,
  swapper,
  tokenIn,
  tokenOut,
  amount,
  addToPool = false
) {
  const abiCoder = new ethers.utils.AbiCoder();
  const title = 'Lets APE into Token';
  const description = 'TOKEN MOON';
  const contractAddresses = [tokenIn, swapper];
  const actions = [
    'transfer(address,uint256)',
    'swapTokens(address,address,uint256)',
  ];
  const params = [
    abiCoder.encode(['address', 'uint'], [swapper, amount]),
    abiCoder.encode(
      ['address', 'address', 'uint256'],
      [tokenIn, tokenOut, amount]
    ),
  ];

  if (addToPool) {
    contractAddresses.push(pool.address);
    actions.push('addToken(address,bool,uint256)');
    params.push(
      abiCoder.encode(['address', 'bool', 'uint256'], [tokenOut, false, 0])
    );
  }

  await createProposal(
    backend,
    pool,
    signer,
    title,
    description,
    contractAddresses,
    actions,
    params
  );
}

async function voteForUser(backend, signer, pool, proposalId, mode) {
  const signature = await signMessage(
    signer,
    ['address', 'address', 'uint256', 'uint256'],
    [signer.address, pool.address, proposalId, mode]
  );
  await pool
    .connect(backend)
    .voteForUser(signer.address, proposalId, mode, signature);
}

module.exports = {
  addToWhiteList: addToWhiteList,
  joinPool: joinPool,
  createProposal: createProposal,
  voteForUser: voteForUser,
  createSwapProposal: createSwapProposal,
};
