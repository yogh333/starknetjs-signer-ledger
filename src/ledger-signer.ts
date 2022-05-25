import Stark from '@yogh/hw-app-starknet';
import Transport from '@ledgerhq/hw-transport';

import {
  SignerInterface,
  Invocation,
  InvocationsSignerDetails,
  Signature,
  encode,
  hash,
  typedData,
  transaction,
  Abi,
} from 'starknet';

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, function (byte) {
    return `0${byte.toString(16)}`.slice(-2);
  }).join('');
}

export class LedgerSigner implements SignerInterface {
  public derivationPath = "m/2645'/1195502025'/1148870696'/0'/0'/0";

  private transport: Transport | undefined;

  public constructor(transport: Transport, derivationPath?: string) {
    this.transport = transport;
    if (derivationPath) 
      this.derivationPath = derivationPath;
  }

  public async getPubKey(): Promise<string> {
    try {
      if (!this.transport) {
        throw new Error('Uninitialized transport!');
      }
      const app = new Stark(this.transport);
      const { publicKey } = await app.getPubKey(this.derivationPath);
      return `0x${toHexString(publicKey).slice(2, 2 + 64)}`;
    } catch (err) {
      throw err;
    }
  }

  public async signTransaction(
    transactions: Invocation[],
    transactionsDetail: InvocationsSignerDetails,
    abis?: Abi[]
  ): Promise<Signature> {
    if (abis && abis.length !== transactions.length) {
      throw new Error('ABI must be provided for each transaction or no transaction');
    }
    // now use abi to display decoded data somewhere, but as this signer is headless, we can't do that

    const calldata = transaction.fromCallsToExecuteCalldataWithNonce(
      transactions,
      transactionsDetail.nonce
    );

    const msgHash = hash.calculcateTransactionHash(
      transactionsDetail.walletAddress,
      transactionsDetail.version,
      hash.getSelectorFromName('__execute__'),
      calldata,
      transactionsDetail.maxFee,
      transactionsDetail.chainId
    );

    return this.sign(msgHash);
  }

  public async signMessage(data: typedData.TypedData, accountAddress: string): Promise<Signature> {
    const msgHash = typedData.getMessageHash(data, accountAddress);

    return this.sign(msgHash);
  }

  public async sign(msg: string): Promise<Signature> {
    try {
      if (!this.transport) {
        throw new Error('Uninitialized transport!');
      }
      const app = new Stark(this.transport);
      const response = await app.signFelt(this.derivationPath, msg);
      return [
        encode.addHexPrefix(toHexString(response.r)),
        encode.addHexPrefix(toHexString(response.s)),
      ];
    } catch (err) {
      throw err;
    }
  }
}
