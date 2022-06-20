const { ethers } = require('hardhat');

async function signMessage(signer, types, params, packed = true) {
  let message;
  if (packed) {
    message = ethers.utils.solidityKeccak256(types, params);
  } else {
    message = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(types, params)
    );
  }
  const bytes = ethers.utils.arrayify(message);
  const signature = await signer.signMessage(bytes);
  console.log('Message:', params);
  console.log('Packed:', packed);
  console.log('Signature:', signature, '\n');
}

async function main() {
  const [user] = await ethers.getSigners();

  console.log('Add To WhiteList');
  console.log('Legende: Signer | Pool | Mitglied');
  await signMessage(
    user,
    ['address', 'address', 'address'],
    [
      user.address,
      '0x5773f52306e33df9704aed3f6fbec759d59a6ca0',
      '0x7e0b49362897706290b7312D0b0902a1629397D8',
    ],
    true
  );

  // await signMessage(user, ['string'], ['Sehr Geiler Dorsch'], true);
  // await signMessage(user, ['string'], ['Sehr Geiler Dorsch'], false);

  // await signMessage(
  //   user,
  //   ['string', 'string'],
  //   ['Sehr Geiler Dorsch', 'übrigens'],
  //   true
  // );
  // await signMessage(
  //   user,
  //   ['string', 'string'],
  //   ['Sehr Geiler Dorsch', 'übrigens'],
  //   false
  // );

  // await signMessage(
  //   user,
  //   ['string', 'address', 'uint', 'bytes'],
  //   ['Sehr Geiler Dorsch', user.address, 69, '0x042069'],
  //   true
  // );
  // await signMessage(
  //   user,
  //   ['string', 'address', 'uint', 'bytes'],
  //   ['Sehr Geiler Dorsch', user.address, 69, '0x042069'],
  //   false
  // );

  // await signMessage(
  //   user,
  //   ['string[]', 'address[]', 'uint[]', 'bytes[]'],
  //   [
  //     ['Sehr Geiler Dorsch', 'Sehr sehr geil'],
  //     [user.address, user2.address],
  //     [69, 420],
  //     ['0x042069', '0x37194527493762743A'],
  //   ],
  //   true
  // );
  // await signMessage(
  //   user,
  //   ['string[]', 'address[]', 'uint[]', 'bytes[]'],
  //   [
  //     ['Sehr Geiler Dorsch', 'Sehr sehr geil'],
  //     [user.address, user2.address],
  //     [69, 420],
  //     ['0x042069', '0x37194527493762743A'],
  //   ],
  //   false
  // );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
