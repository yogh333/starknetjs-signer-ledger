import Stark from '@ledgerhq/hw-app-starknet';
import Transport from '@ledgerhq/hw-transport';
import TransportNodeHid from '@ledgerhq/hw-transport-node-hid';
import TransportWebHID from '@ledgerhq/hw-transport-webhid';

import {
    SignerInterface, 
    Invocation, 
    InvocationsSignerDetails, 
    Signature, 
    encode, 
    hash, 
    typedData 
} from 'starknet';

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, function (byte) {
    return `0${byte.toString(16)}`.slice(-2);
  }).join('');
}

export class LedgerSigner implements SignerInterface {
  public derivationPath = "m/2645'/579218131'/0'/0'";

  private transport: Transport | undefined;

  private async getStarwareApp(): Promise<Stark> {
    if (!this.transport) {
      try {
        if (process.env.NODE_ENV === 'test') this.transport = await TransportNodeHid.create();
        else this.transport = await TransportWebHID.create();
      } catch {
        throw new Error('Device connection error');
      }
    }
    return new Stark(this.transport);
  }

  public async getPubKey(): Promise<string> {
    const app = await this.getStarwareApp();
    const { publicKey } = await app.getPubKey(this.derivationPath);

    return `0x${toHexString(publicKey).slice(2, 2 + 64)}`;
  }

  public async signTransaction(
    transactions: Invocation[],
    transactionsDetail: InvocationsSignerDetails
  ): Promise<Signature> {
    const msgHash = hash.hashMulticall(
      transactionsDetail.walletAddress,
      transactions,
      transactionsDetail.nonce.toString(),
      transactionsDetail.maxFee.toString(),
      transactionsDetail.version.toString()
    );

    return this.sign(msgHash);
  }

  public async signMessage(data: typedData.TypedData, accountAddress: string): Promise<Signature> {
    const msgHash = typedData.getMessageHash(data, accountAddress);

    return this.sign(msgHash);
  }

  public async sign(msg: string): Promise<Signature> {
    const app = await this.getStarwareApp();

    console.log(`Message = ${msg}`);

    const response = await app.signFelt(this.derivationPath, msg);

    return [encode.addHexPrefix(toHexString(response.r)), encode.addHexPrefix(toHexString(response.s))];
  }
}
