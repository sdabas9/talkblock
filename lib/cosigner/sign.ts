import {
  APIClient,
  Action,
  PackedTransaction,
  PrivateKey,
  Serializer,
  SignedTransaction,
  Transaction,
} from "@wharfkit/antelope"

export interface ActionInput {
  account: string
  name: string
  authorization: { actor: string; permission: string }[]
  data: Record<string, unknown>
}

export interface CosignedTx {
  packed_trx: string
  signatures: string[]
  transaction: Record<string, unknown>
}

const VAULTA_RPC = "https://eos.greymass.com"

export async function buildAndSignCosign(
  userActions: ActionInput[],
  expireSeconds: number = 300,
): Promise<CosignedTx> {
  const cosignAccount = process.env.COSIGN_ACCOUNT
  const cosignPermission = process.env.COSIGN_PERMISSION
  const noopContract = process.env.NOOP_CONTRACT
  const cosignPrivateKey = process.env.COSIGN_PRIVATE_KEY

  if (!cosignAccount || !cosignPermission || !noopContract || !cosignPrivateKey) {
    throw new Error("Cosigner not configured (missing env vars)")
  }

  const client = new APIClient({ url: VAULTA_RPC })
  const info = await client.v1.chain.get_info()
  const header = info.getTransactionHeader(expireSeconds)

  const noopAction: ActionInput = {
    account: noopContract,
    name: "noop",
    authorization: [{ actor: cosignAccount, permission: cosignPermission }],
    data: { memo: `tlbk-${Date.now()}` },
  }

  const allActions = [noopAction, ...userActions]

  const actions = await Promise.all(
    allActions.map(async (a) => {
      const abi = await client.v1.chain.get_abi(a.account)
      if (!abi.abi) throw new Error(`No ABI for ${a.account}`)
      return Action.from(
        {
          account: a.account,
          name: a.name,
          authorization: a.authorization,
          data: a.data,
        },
        abi.abi,
      )
    }),
  )

  const transaction = Transaction.from({
    ...header,
    actions,
  })

  const cosignKey = PrivateKey.from(cosignPrivateKey)
  const cosignSig = cosignKey.signDigest(transaction.signingDigest(info.chain_id))

  const signed = SignedTransaction.from({
    ...transaction,
    signatures: [cosignSig],
  })

  // Use PackedTransaction.fromSigned to produce the canonical packed bytes —
  // this is the same encoding the chain expects in /v1/chain/push_transaction.
  const packed = PackedTransaction.fromSigned(signed)

  return {
    packed_trx: packed.packed_trx.hexString,
    signatures: [String(cosignSig)],
    transaction: Serializer.objectify(transaction) as Record<string, unknown>,
  }
}
