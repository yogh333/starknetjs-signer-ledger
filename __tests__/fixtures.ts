import fs from 'fs';

import { Account, Provider, ec, json } from 'starknet';
import { CompiledContract } from 'starknet';

const readContract = (name: string): CompiledContract =>
  json.parse(fs.readFileSync(`./__mocks__/${name}.json`).toString('ascii'));

export const compiledOpenZeppelinAccount = readContract('Account');
export const compiledErc20 = readContract('ERC20');
export const compiledTypeTransformation = readContract('contract');
export const compiledMulticall = readContract('multicall');
export const compiledTestDapp = readContract('TestDapp');

const DEFAULT_TEST_PROVIDER_BASE_URL = 'http://127.0.0.1:5050/';
const DEFAULT_TEST_ACCOUNT_ADDRESS = // run `starknet-devnet --seed 0` and this will be the first account
  '0x7e00d496e324876bbc8531f2d9a82bf154d1a04a50218ee74cdd372f75a551a';
const DEFAULT_TEST_ACCOUNT_PRIVATE_KEY = '0xe3e70682c2094cac629f6fbed82c07cd';

const BASE_URL = process.env.TEST_PROVIDER_BASE_URL || DEFAULT_TEST_PROVIDER_BASE_URL;
export const IS_DEVNET = !BASE_URL.includes('starknet.io');

export const getTestProvider = () => {
  const provider = new Provider({ baseUrl: BASE_URL });

  if (IS_DEVNET) {
    // accelerate the tests when running locally
    const originalWaitForTransaction = provider.waitForTransaction.bind(provider);
    provider.waitForTransaction = (txHash, retryInterval) => {
      return originalWaitForTransaction(txHash, retryInterval || 1000);
    };
  }

  return provider;
};

// test account with fee token balance
export const getTestAccount = () => {
  const provider = getTestProvider();

  const testAccountAddress = process.env.TEST_ACCOUNT_ADDRESS || DEFAULT_TEST_ACCOUNT_ADDRESS;
  const testAccountPrivateKey =
    process.env.TEST_ACCOUNT_PRIVATE_KEY || DEFAULT_TEST_ACCOUNT_PRIVATE_KEY;

  return new Account(provider, testAccountAddress, ec.getKeyPair(testAccountPrivateKey));
};

export const testIf = (condition: boolean) => (condition ? test : test.skip);
export const testIfDevnet = testIf(IS_DEVNET);
export const testIfNotDevnet = testIf(!IS_DEVNET);