import Stark from '@yogh/hw-app-starknet';
import Transport from '@ledgerhq/hw-transport';
import TransportWebUSB from '@ledgerhq/hw-transport-webusb';

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
  number,
} from 'starknet';

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, function (byte) {
    return `0${byte.toString(16)}`.slice(-2);
  }).join('');
}

export class LedgerSigner implements SignerInterface {
  public derivationPath: string;

  private transport: Transport | undefined;
  private external_transport_flag: boolean;

  static async askPermission(): Promise<void> {
    const transport = await TransportWebUSB.create();
    await transport.close();
  }

  public constructor(derivationPath: string, transport?: Transport) {
    this.derivationPath = derivationPath;
    if (transport) {
      this.transport = transport;
      this.external_transport_flag = true;
    } else this.external_transport_flag = false;
  }

  public async getPubKey(): Promise<string> {
    try {
      if (this.external_transport_flag && !this.transport) {
        throw new Error('Uninitialized transport!');
      } else if (!this.external_transport_flag) {
        this.transport = await TransportWebUSB.create();
      }
      const app = new Stark(this.transport as Transport);
      const { publicKey } = await app.getPubKey(this.derivationPath);
      if (!this.external_transport_flag) {
        await this.transport?.close();
      }
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

    const signature = await this.sign(msgHash, transactionsDetail.maxFee == 0 ? false : true);

    return signature;
  }

  public async signMessage(data: typedData.TypedData, accountAddress: string): Promise<Signature> {
    const msgHash = typedData.getMessageHash(data, accountAddress);

    const signature = await this.sign(msgHash, true);

    return signature;
  }

  private async sign(msg: string, show: boolean): Promise<Signature> {
    try {
      if (this.external_transport_flag && !this.transport) {
        throw new Error('Uninitialized transport!');
      } else if (!this.external_transport_flag) {
        this.transport = await TransportWebUSB.create();
      }
      const app = new Stark(this.transport as Transport);

      const response = await app.signFelt(this.derivationPath, msg, show);

      if (!this.external_transport_flag) await this.transport?.close();
      return [
        encode.addHexPrefix(toHexString(response.r)),
        encode.addHexPrefix(toHexString(response.s)),
      ];
    } catch (err) {
      throw err;
    }
  }
}
