import fs from 'fs';

import { json, CompiledContract } from "starknet";

const readContract = (name: string): CompiledContract =>
  json.parse(fs.readFileSync(`./mocks/${name}.json`).toString('ascii'));

export const compiledArgentAccount = readContract('ArgentAccount');
export const compiledErc20 = readContract('ERC20');
export const compiledTypeTransformation = readContract('contract');
export const compiledMulticall = readContract('multicall');
export const compiledTestDapp = readContract('TestDapp');
