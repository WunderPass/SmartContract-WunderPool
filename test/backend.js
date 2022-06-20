const { signMessage, topUp, approve, usdc, usdcBalance } = require('./helpers');

require('@nomiclabs/hardhat-waffle');

async function createPool(
  launcher,
  user,
  {
    amount,
    members,
    minInvest,
    maxInvest,
    maxMembers,
    votingPercent,
    votingTime,
    minYesVoters,
  }
) {
  await topUp(user, usdc((amount == undefined ? 10 : amount) + 2));
  await approve(
    user,
    launcher.address,
    usdc(amount == undefined ? 10 : amount)
  );
  await launcher.createNewPool(
    'Dorsch Pool',
    'Dorsch Pool Token',
    'DPT',
    usdc(amount == undefined ? 10 : amount),
    user.address,
    members || [],
    usdc(minInvest == undefined ? 10 : minInvest),
    usdc(maxInvest == undefined ? 20 : maxInvest),
    maxMembers == undefined ? 4 : maxMembers,
    votingPercent == undefined ? 51 : votingPercent,
    votingTime == undefined ? 86400 : votingTime,
    minYesVoters == undefined ? 1 : minYesVoters
  );
}

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

async function addToWhiteListSecret(backend, signer, pool, validCount, secret) {
  const hashedSecret = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(secret));

  const signature = await signMessage(
    signer,
    ['address', 'address', 'bytes32', 'uint256'],
    [signer.address, pool.address, hashedSecret, validCount]
  );
  await pool
    .connect(backend)
    .addToWhiteListWithSecret(
      signer.address,
      hashedSecret,
      validCount,
      signature
    );
}

async function joinPool(backend, user, pool, amount, secret = '') {
  await topUp(user, usdc(amount).mul(11).div(10));
  await approve(user, pool.address, usdc(amount));
  await pool.connect(backend).joinForUser(usdc(amount), user.address, secret);
}

async function createJoinProposal(backend, user, pool, amount, govTokens) {
  await topUp(user, usdc(amount).mul(11).div(10));
  await approve(user, pool.address, usdc(amount));
  await pool
    .connect(backend)
    .createJoinProposal(
      user.address,
      'Let me In',
      `I will pay ${amount}$ to join`,
      usdc(amount),
      govTokens
    );
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

async function delegateVotes(backend, signer, govToken, user) {
  const userAddress = user?.address || user;

  const nonce = await govToken.nonces(signer.address);
  const signature = await signMessage(
    signer,
    ['address', 'address', 'address', 'uint256'],
    [signer.address, govToken.address, userAddress, nonce]
  );

  await govToken
    .connect(backend)
    .delegateForUser(signer.address, userAddress, signature);
}

async function revokeVotes(backend, signer, govToken) {
  const nonce = await govToken.nonces(signer.address);
  const signature = await signMessage(
    signer,
    ['address', 'address', 'uint256'],
    [signer.address, govToken.address, nonce]
  );

  await govToken.connect(backend).revokeForUser(signer.address, signature);
}

module.exports = {
  createPool: createPool,
  addToWhiteList: addToWhiteList,
  addToWhiteListSecret: addToWhiteListSecret,
  joinPool: joinPool,
  createProposal: createProposal,
  createJoinProposal: createJoinProposal,
  voteForUser: voteForUser,
  delegateVotes: delegateVotes,
  revokeVotes: revokeVotes,
  createSwapProposal: createSwapProposal,
};
