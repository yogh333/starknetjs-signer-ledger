import { 
  Stark,
  Calldata, 
  TxDetails
} from '@ledgerhq/hw-app-starknet';
import Transport from '@ledgerhq/hw-transport';

import {
  SignerInterface,
  DeclareSignerDetails,
  Call,
  InvocationsSignerDetails,
  Signature,
  encode,
  typedData,
  Abi,
} from 'starknet';

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, function (byte) {
    return `0${byte.toString(16)}`.slice(-2);
  }).join('');
}

export class LedgerSigner implements SignerInterface {
  
  public derivationPath: string

  private ledger: Stark

  public constructor(derivationPath: string, transport: Transport) {
    this.derivationPath = derivationPath
    this.ledger = new Stark(transport)
  }

   /**
   * Get the Starknet public key
   * 
   * @returns {string} the public key
   */
  public async getPubKey(): Promise<string> {
    
      const { publicKey } = await this.ledger.getPubKey(this.derivationPath)
      
      return `0x${toHexString(publicKey).slice(2, 2 + 64)}`
  }

   /**
   * Sign a Starknet invoke transaction
   * 
   * @param {Invocation[]}  transactions - arrays of transactions to be signed
   * @param {InvocationsSignerDetails} transactionsDetail - addtional information about transactions
   * @returns {signature} the tx signature
   */
  public async signTransaction(
    transactions: Call[],
    transactionsDetail: InvocationsSignerDetails,
    abis?: Abi[]
  ): Promise<Signature> {
    
    if (transactions.length != 1) {
      throw new Error('Signing multiple transactions on device not yet implemented')
    }

    if (abis && abis.length !== transactions.length) {
      throw new Error('ABI must be provided for each transaction or no transaction')
    }

    const tx: Calldata = {
      contractAddress: transactions[0].contractAddress,
      entrypoint: transactions[0].entrypoint,
      calldata: transactions[0].calldata ? transactions[0].calldata as string[]:undefined
    }

    const txDetails: TxDetails = {
      nonce: transactionsDetail.nonce,
      maxFee: transactionsDetail.maxFee,
      version: transactionsDetail.version,
      accountAddress: transactionsDetail.walletAddress,
      chainId: transactionsDetail.chainId
    }
  
    const response = await this.ledger.signTx(this.derivationPath, tx, txDetails, abis?.pop())

    return [
      encode.addHexPrefix(toHexString(response.r)),
      encode.addHexPrefix(toHexString(response.s)),
    ]
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

    const response = await this.ledger.sign(this.derivationPath, msg, show)
    
    return [
        encode.addHexPrefix(toHexString(response.r)),
        encode.addHexPrefix(toHexString(response.s)),
    ]
  }

  public async signDeclareTransaction(transaction: DeclareSignerDetails): Promise<Signature> {
    throw new Error('not implemented')
  }
}
