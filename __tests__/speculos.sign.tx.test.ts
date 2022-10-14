import { LedgerSigner } from '../src/ledger-signer';
import { Account, Contract, number } from 'starknet';
import { compiledOpenZeppelinAccount, compiledTestDapp, getTestProvider } from './fixtures';
import SpeculosTransport from "@ledgerhq/hw-transport-node-speculos";
import Transport from '@ledgerhq/hw-transport';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// Before running this test, please follow theses steps:
// 1. In a terminal, launch speculos and Nano Starknet app:  
//      "speculos --display headless --api-port 9999 --apdu-port 5001 app_s.elf"
// 2. In another terminal, launch starknet-devnet client:
//      "starknet-devnet"
// 3. In another terminal, lauch the test:
//      "yarn test __tests__/ledger.sign.tx.speculos.test.ts"
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const PATH = "m/2645'/1195502025'/1148870696'/0'/0'/0";
const apduPort = 9999;

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

    console.log("account address =" + accountResponse.contract_address)

    account = new Account(provider, accountResponse.contract_address, signer);

    await provider.waitForTransaction(accountResponse.transaction_hash);

    const dappResponse = await provider.deployContract({
      contract: compiledTestDapp,
    });

    dapp = new Contract(compiledTestDapp.abi, dappResponse.contract_address, provider)

    await provider.waitForTransaction(dappResponse.transaction_hash);

    let data = {
      address: account.address,
      amount: 1000000000000000000000
    };

    await fetch("http://127.0.0.1:5050/mint", {
      method: "POST",
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify(data)
    })

  });

  afterAll(async () => {
    await transport.close();
  })


  test('execute by wallet owner', async () => {

    const { transaction_hash } = await account.execute(
      {
        contractAddress: dapp.address,
        entrypoint: 'set_number',
        calldata: ['666'],
      },
      undefined,
      { maxFee: '1000000000000000' }
    );

    await provider.waitForTransaction(transaction_hash);
    
    const response = await dapp.get_number(account.address);

    expect(number.toBN(response.number as string).toString()).toStrictEqual('666');
  });
});
