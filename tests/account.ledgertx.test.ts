import { LedgerSigner } from '../src/ledger-signer';
import { Account, Contract, defaultProvider, number } from 'starknet';
import { compiledArgentAccount, compiledTestDapp } from './fixtures';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import Transport from '@ledgerhq/hw-transport';

const PATH = "m/2645'/1195502025'/1148870696'/0'/0'/0";

describe('deploy and test Wallet', () => {
  let signer: LedgerSigner;
  let transport: Transport;
  let starkKeyPub: string;

  let account: Account;
  let dapp: Contract;

  beforeAll(async () => {
    transport = await TransportNodeHid.create();

    signer = new LedgerSigner(PATH, transport);

    starkKeyPub = await signer.getPubKey();

    const accountResponse = await defaultProvider.deployContract({
      contract: compiledArgentAccount,
      addressSalt: starkKeyPub,
    });

    const contract = new Contract(compiledArgentAccount.abi, accountResponse.address);
    expect(accountResponse.code).toBe('TRANSACTION_RECEIVED');

    const initializeResponse = await contract.initialize(starkKeyPub, '0');
    expect(initializeResponse.code).toBe('TRANSACTION_RECEIVED');

    account = new Account(defaultProvider, accountResponse.address, signer);

    const dappResponse = await defaultProvider.deployContract({
      contract: compiledTestDapp,
    });

    dapp = new Contract(compiledTestDapp.abi, dappResponse.address);
    expect(dappResponse.code).toBe('TRANSACTION_RECEIVED');
    await defaultProvider.waitForTransaction(dappResponse.transaction_hash);
  });

  test('same wallet address', () => {
    expect(account.address).toBe(account.address);
  });

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
