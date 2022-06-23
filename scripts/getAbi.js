async function main() {
  const contract = await ethers.getContractFactory('WunderPoolEpsilon');
  console.log(contract.interface.format('full'));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
