const { createProposal } = require('../test/backend');

const poolAddress = 'INSERT_ADDRESS';

async function main() {
  if (poolAddress.length < 42) throw 'Invalid Pool Address';

  const [user] = await ethers.getSigners();

  const pool = await ethers.getContractAt(`WunderPoolEta`, poolAddress, user);
  await pool
    .name()
    .then(async (name) => {
      console.log(`Creating Liquidate Proposal for Pool "${name}"`);
      await createProposal(
        user,
        pool,
        user,
        'Liquidate The Pool',
        'Lets get out',
        [pool.address],
        ['liquidatePool()'],
        ['0x']
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
