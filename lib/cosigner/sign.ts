import {
  APIClient,
  Action,
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

  // Construct a SignedTransaction to validate the sig is well-formed
  void SignedTransaction.from({
    ...transaction,
    signatures: [cosignSig],
  })

  return {
    packed_trx: Serializer.encode({ object: transaction }).hexString,
    signatures: [String(cosignSig)],
    transaction: Serializer.objectify(transaction) as Record<string, unknown>,
  }
}
