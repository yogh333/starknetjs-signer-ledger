import Stark from '@ledgerhq/hw-app-starknet';
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
    if (transport !== undefined) {
      this.transport = transport;
      this.external_transport_flag = true;
    } else this.external_transport_flag = false;
  }

   /**
   * Get the Starknet public key
   * 
   * @returns {string} the public key
   */
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

   /**
   * Sign a Starknet transaction
   * 
   * @param {Invocation[]}  transactions - arrays of transactions to be signed
   * @param {InvocationsSignerDetails} transactionsDetail - addtional information about transactions
   * @returns {signature} the tx signature
   */
  public async signTransaction(
    transactions: Invocation[],
    transactionsDetail: InvocationsSignerDetails,
    abis?: Abi[]
  ): Promise<Signature> {
    if (abis && abis.length !== transactions.length) {
      throw new Error('ABI must be provided for each transaction or no transaction');
    }
    
    // now use abi to display decoded data somewhere

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

   /**
   * Sign a typed data with the private key set by derivation path
   * 
   * @param {typedData.TypedData}  data - data to be signed
   * @param {string} accountAddress - account address
   * @returns {signature} the msg signature
   */
  public async signMessage(data: typedData.TypedData, accountAddress: string): Promise<Signature> {
    const msgHash = typedData.getMessageHash(data, accountAddress);

    const signature = await this.sign(msgHash, true);

    return signature;
  }

  /**
   * Sign a bytestring (e.g perdersen hash) with the private key set by derivation path
   * 
   * @param {string}  msg - bytestring to be signed
   * @param {boolean} show - if true, display the msg to be signed
   * @returns {signature} the msg signature
   */
  public async sign(msg: string, show: boolean): Promise<Signature> {
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
