import { LedgerSigner } from '../src/ledger-signer';
import { Account, Contract, defaultProvider, number } from 'starknet';
import { compiledArgentAccount, compiledTestDapp } from './fixtures';
import { DeviceShouldStayInApp } from '../../../Ledger/ledgerjs/node_modules/@ledgerhq/errors/lib';

describe('deploy and test Wallet', () => {
  const signer = new LedgerSigner();
  let starkKeyPub;

  let account: Account;
  let dapp: Contract;

  beforeAll(async () => {
    starkKeyPub = await signer.getPubKey();

    const accountResponse = await defaultProvider.deployContract({
      contract: compiledArgentAccount,
      addressSalt: starkKeyPub,
    });

    console.log('deploy account contract' + accountResponse.address);

    const contract = new Contract(compiledArgentAccount.abi, accountResponse.address);
    expect(accountResponse.code).toBe('TRANSACTION_RECEIVED');

    const initializeResponse = await contract.initialize(starkKeyPub, '0');
    expect(initializeResponse.code).toBe('TRANSACTION_RECEIVED');

    console.log('initialize account contract with Pub Key' + starkKeyPub);

    account = new Account(defaultProvider, accountResponse.address, signer);

    const dappResponse = await defaultProvider.deployContract({
      contract: compiledTestDapp,
    });

    console.log('deploy ok dapp ' + dappResponse.address);

    dapp = new Contract(compiledTestDapp.abi, dappResponse.address);
    expect(dappResponse.code).toBe('TRANSACTION_RECEIVED');
    await defaultProvider.waitForTransaction(dappResponse.transaction_hash);
  });

  test('same wallet address', () => {
    expect(account.address).toBe(account.address);
  });

  /*test('read nonce', async () => {
    const { result } = await account.callContract({
      contractAddress: account.address,
      entrypoint: 'get_nonce',
    });
    const nonce = result[0];

    expect(number.toBN(nonce).toString()).toStrictEqual(number.toBN(0).toString());
  });*/

  test('is_validsignature', async () => {
    const msg = '0x749552d5a30f49c46e5e07f20bfc5dbe7b22cf90fcf7848b4a7ff0270400e79';
    const signature = await signer.sign(msg);

    const res = await account.verifyMessageHash(msg, signature);

    expect(res).toBe(true);
  });

  test('execute by wallet owner', async () => {
    const { code, transaction_hash } = await account.execute(
      {
        contractAddress: dapp.address,
        entrypoint: 'set_number',
        calldata: ['666'],
      },
      undefined,
      { maxFee: '0' }
    );

    expect(code).toBe('TRANSACTION_RECEIVED');
    await defaultProvider.waitForTransaction(transaction_hash);

    const response = await dapp.get_number(account.address);
    expect(number.toBN(response.number as string).toString()).toStrictEqual('666');
  });
});
