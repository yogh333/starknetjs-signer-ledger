import { LedgerSigner } from '../src/ledger-signer';
import { Contract, number } from 'starknet';
import { compiledOpenZeppelinAccount, getTestProvider } from './fixtures';
import SpeculosTransport from "@ledgerhq/hw-transport-node-speculos";
import Transport from '@ledgerhq/hw-transport';

// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
// Before running this test, please follow theses steps:
// 1. In a terminal, launch speculos and Nano Starknet app:  
//      "speculos --display headless --api-port 9999 --apdu-port 5001 app_s.elf"
// 2. In another terminal, launch starknet-devnet client:
//      "starknet-devnet"
// 3. In another terminal, lauch the test:
//      "yarn test __tests__/ledger.sign.hash.speculos.test.ts"
// !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

const PATH = "m/2645'/1195502025'/1148870696'/0'/0'/0";
const apduPort = 9999;

describe('deploy and test Ledger secured wallet', () => {

  let transport: Transport;

  let signer: LedgerSigner;

  let contract: Contract;

  const provider = getTestProvider();

  beforeAll(async () => {

    transport = await SpeculosTransport.open({ apduPort });

    signer = new LedgerSigner(PATH, transport);

    const starkKeyPub = await signer.getPubKey();

    const accountResponse = await provider.deployContract({
      contract: compiledOpenZeppelinAccount,
      constructorCalldata: [starkKeyPub],
      addressSalt: starkKeyPub,
    });

    contract = new Contract(compiledOpenZeppelinAccount.abi, accountResponse.contract_address);
    
    await provider.waitForTransaction(accountResponse.transaction_hash);
  });

  afterAll(async () => {
    await transport.close();
  })

  test('verify signature', async () => {

    const msg = '0x3e661e74490ed120678d23913c3e67681bf63974f45a15b50e3a6b6703bb59e'
    const signature = await signer.sign(msg, false);

    const isValid = await provider.callContract({
      contractAddress: contract.address,
      entrypoint: 'isValidSignature',
      calldata: [
        number.toBN(msg).toString(),
        '2',
        number.toBN(signature[0]).toString(),
        number.toBN(signature[1]).toString(),
      ],
    });

    expect(isValid).toEqual({ result: ['0x1'] });
  });
});
