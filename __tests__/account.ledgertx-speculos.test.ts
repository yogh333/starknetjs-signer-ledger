import { LedgerSigner } from '../src/ledger-signer';
import { Account, Contract, defaultProvider, number } from 'starknet';
import { compiledOpenZeppelinAccount, compiledTestDapp, getTestProvider } from './fixtures';
import SpeculosTransport from "@ledgerhq/hw-transport-node-speculos";
import Transport from '@ledgerhq/hw-transport';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// Before running this test, please follow theses steps:
// 1. In a terminal, launch speculos and Nano Starknet app:  
//      "speculos --display headless --vnc-port 41000 --api-port 5001 --apdu-port 4001 app_s.elf"
// 2. In another terminal, launch starknet-devnet client:
//      "starknet-devnet --seed 0"
// 3. In another terminal, lauch the test:
//      "yarn test __tests__/account.ledgertx-speculos.test.ts"
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const PATH = "m/2645'/1195502025'/1148870696'/0'/0'/0";
const apduPort = 4001;

describe('deploy and test Wallet', () => {
  let signer: LedgerSigner;
  let transport: Transport;
  let starkKeyPub: string;

  let account: Account;
  let dapp: Contract;

  const provider = getTestProvider();

  beforeAll(async () => {
    transport = await SpeculosTransport.open({ apduPort });

    signer = new LedgerSigner(PATH, transport);

    starkKeyPub = await signer.getPubKey();

    const accountResponse = await provider.deployContract({
      contract: compiledOpenZeppelinAccount,
      constructorCalldata: [starkKeyPub],
      addressSalt: starkKeyPub,
    });
    expect(accountResponse.code).toBe('TRANSACTION_RECEIVED');

    const contract = new Contract(compiledOpenZeppelinAccount.abi, accountResponse.address as string);

    account = new Account(provider, accountResponse.address as string, signer);

    const dappResponse = await provider.deployContract({
      contract: compiledTestDapp,
    });
    expect(dappResponse.code).toBe('TRANSACTION_RECEIVED');

    dapp = new Contract(compiledTestDapp.abi, dappResponse.address as string, provider);

    await provider.waitForTransaction(dappResponse.transaction_hash);
  });

  afterAll(async () => {
    await transport.close();
  })

  test('same wallet address', () => {
    expect(account.address).toBe(account.address);
  });

  test('is_validsignature', async () => {
    const msg = '0x749552d5a30f49c46e5e07f20bfc5dbe7b22cf90fcf7848b4a7ff0270400e79';
    const signature = await signer.sign(msg, false);

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
    await provider.waitForTransaction(transaction_hash);

    const response = await dapp.get_number(account.address);

    console.log(response);

    expect(number.toBN(response.number as string).toString()).toStrictEqual('666');
  });
});
