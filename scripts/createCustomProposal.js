const { createProposal } = require('../test/backend');
const { usdcAddress } = require('../test/helpers');

const poolAddress = '0x9b3d8d3a0ec3b2505aea26ad1c941e3ce8bf002d';

async function main() {
  if (poolAddress.length < 42) throw 'Invalid Pool Address';

  const [user] = await ethers.getSigners();

  const pool = await ethers.getContractAt(
    `WunderPoolEpsilon`,
    poolAddress,
    user
  );
  const abiCoder = new ethers.utils.AbiCoder();
  const params = [
    abiCoder.encode(['address', 'uint'], [user.address, 150000000]),
  ];
  console.log(user.address);

  await pool
    .name()
    .then(async (name) => {
      console.log(`Creating Liquidate Proposal for Pool "${name}"`);
      await createProposal(
        user,
        pool,
        user,
        'Send 25$ to Gerwin and 25$ to Moritz',
        'Artem lost his keys',
        [usdcAddress],
        ['transfer(address,uint256)'],
        params
      )
        .then((tx) => {
          console.log(`✅ Created Proposal`);
        })
        .catch((err) => {
          console.log(`⚠️  ${err.error.message}`);
        });
    })
    .catch((err) => {
      console.log('Pool does not exist');
    });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
