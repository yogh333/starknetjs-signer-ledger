import { LedgerSigner } from '../src/ledger-signer';
import { Contract, defaultProvider, number } from 'starknet';
import { compiledArgentAccount } from './fixtures';

describe('deploy and test Wallet', () => {
  const signer = new LedgerSigner();

  // const provider = new Provider();

  let contract: Contract;

  beforeAll(async () => {
    const starkKeyPub = await signer.getPubKey();

    console.log('starkKey Pub ' + starkKeyPub);

    /*console.log("Deploy Account contract");

    const accountResponse = await defaultProvider.deployContract({
      contract: compiledArgentAccount,
      addressSalt: starkKeyPub,
    });

    console.log("accountResponse " + accountResponse);
    */

    contract = new Contract(
      compiledArgentAccount.abi,
      '0x5fbd9da6bc447d4e4024408479667335748254d577503cd79530b0bc0c453db'
    );
    //expect(accountResponse.code).toBe('TRANSACTION_RECEIVED');

    /*const initializeResponse = await contract.initialize(starkKeyPub, '0');
    expect(initializeResponse.code).toBe('TRANSACTION_RECEIVED');

    await defaultProvider.waitForTransaction(accountResponse.transaction_hash);*/
  });

  test('verify signature', async () => {
    //const msg = '0x2bd1d3f8f45a011cbd0674ded291d58985761bbcbc04f4d01c8285d1b35c411';
    const msg = '0x749552d5a30f49c46e5e07f20bfc5dbe7b22cf90fcf7848b4a7ff0270400e79';
    const signature = await signer.sign(msg);

    const isValid = await defaultProvider.callContract({
      contractAddress: contract.address,
      entrypoint: 'is_valid_signature',
      calldata: [
        number.toBN(msg).toString(),
        '2',
        number.toBN(signature[0]).toString(),
        number.toBN(signature[1]).toString(),
      ],
    });
    expect(isValid).toEqual({ result: [] });
  });
});
