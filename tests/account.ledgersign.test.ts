import { LedgerSigner } from '../src/ledger-signer';
import { Contract, defaultProvider, number } from 'starknet';
import { compiledArgentAccount } from './fixtures';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import Transport from '@ledgerhq/hw-transport';

const PATH = "m/2645'/1195502025'/1148870696'/0'/0'/0";

describe('deploy and test Wallet', () => {
  let transport: Transport;

  let signer: LedgerSigner;

  let contract: Contract;

  beforeAll(async () => {
    transport = await TransportNodeHid.create();

    signer = new LedgerSigner(PATH, transport);

    const starkKeyPub = await signer.getPubKey();

    const accountResponse = await defaultProvider.deployContract({
      contract: compiledArgentAccount,
      addressSalt: starkKeyPub,
    });

    contract = new Contract(compiledArgentAccount.abi, accountResponse.address);
    expect(accountResponse.code).toBe('TRANSACTION_RECEIVED');

    const initializeResponse = await contract.initialize(starkKeyPub, '0');
    expect(initializeResponse.code).toBe('TRANSACTION_RECEIVED');

    await defaultProvider.waitForTransaction(accountResponse.transaction_hash);
  });

  test('verify signature', async () => {
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
