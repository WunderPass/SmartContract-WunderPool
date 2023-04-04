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
  const [
    user,
    a1,
    a2,
    a3,
    a4,
    a5,
    a6,
    a7,
    a8,
    a9,
    a10,
    a11,
    a12,
    a13,
    a14,
    a15,
    a16,
    a17,
  ] = await ethers.getSigners();
  console.log('Signing with', a16.address);
  await signMessage(
    a16,
    ['uint256', 'uint256[]', 'address', 'uint256[][]'],
    [11, [11], '0x391A85d291Faa9626a3F3e6512485A05Ad68C0Df', [[2, 1]]],
    false
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
