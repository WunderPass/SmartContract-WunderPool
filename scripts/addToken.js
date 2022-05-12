async function main() {
  const [user] = await ethers.getSigners();
  const pool = await ethers.getContractAt(
    'WunderPoolGamma',
    '0xEdA99A8f9145386Df33359bb37c1CaE2FeF94753',
    user
  );

  await pool.addToken('0x845812905256ffa8b16b355bc11a3f3e63c55ab8', true, 304);
  await pool.addToken('0x845812905256ffa8b16b355bc11a3f3e63c55ab8', true, 305);
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
