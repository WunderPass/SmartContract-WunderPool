const { createSwapProposal } = require('../test/backend');
const { usdcAddress } = require('../test/helpers');

const poolAddress = 'INSERT_ADDRESS';
const tokenAddress = 'INSERT_ADDRESS';

const wunderSwapperAddress = '0x6a7ad95F8158F59e524663C648223743DD0695E2';

async function main() {
  if (poolAddress.length < 42) throw '⚠️  Invalid Pool Address';
  if (tokenAddress.length < 42) throw '⚠️  Invalid Token Address';

  const [user] = await ethers.getSigners();

  const pool = await ethers.getContractAt(`WunderPoolEta`, poolAddress, user);
  const token = await ethers.getContractAt(`TestToken`, tokenAddress, user);
  const tokenName = await token.name();
  const tokenBalance = await token.balanceOf(poolAddress);

  if (tokenBalance.lte(0)) throw `⚠️  Pool does not own Token ${tokenName}`;

  await pool
    .name()
    .then(async (name) => {
      console.log(
        `Creating Proposal for Pool "${name}" to sell "${tokenName}"...`
      );
      await createSwapProposal(
        user,
        pool,
        user,
        wunderSwapperAddress,
        tokenAddress,
        usdcAddress,
        tokenBalance,
        false
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
