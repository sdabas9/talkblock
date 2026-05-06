import {
  APIClient,
  Bytes,
  Checksum256,
  PackedTransaction,
  PrivateKey,
  Serializer,
  Transaction,
} from "@wharfkit/antelope"

export interface CosignNoopMeta {
  account: string       // contract on which noop lives
  name: string          // "noop"
  actor: string         // cosignAccount
  permission: string    // cosignPermission
}

export interface CosignResult {
  signature: string
  noop: CosignNoopMeta
}

const VAULTA_RPC = "https://eos.greymass.com"

/**
 * Sign the digest of a client-built transaction with the cosign key, after
 * verifying the transaction's first action is the expected noop authorized by
 * the cosign permission. The client owns the canonical packed_trx; the server's
 * only job here is to add a second signature over the same bytes the user's
 * wallet already signed. This avoids any cross-environment serialization risk.
 */
export async function cosignClientTx(
  packedTrxHex: string,
  chainId: string,
): Promise<CosignResult> {
  const cosignAccount = process.env.COSIGN_ACCOUNT
  const cosignPermission = process.env.COSIGN_PERMISSION
  const noopContract = process.env.NOOP_CONTRACT
  const cosignPrivateKey = process.env.COSIGN_PRIVATE_KEY

  if (!cosignAccount || !cosignPermission || !noopContract || !cosignPrivateKey) {
    throw new Error("Cosigner not configured (missing env vars)")
  }

  // Decode the client-supplied packed_trx
  let transaction: Transaction
  try {
    const packed = PackedTransaction.from({
      signatures: [],
      compression: 0,
      packed_context_free_data: "",
      packed_trx: packedTrxHex,
    })
    transaction = packed.getTransaction()
  } catch (e) {
    throw new Error(`Invalid packed_trx: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Validate the first action is our authorized noop
  const first = transaction.actions[0]
  if (!first) throw new Error("Empty actions")
  if (String(first.account) !== noopContract) {
    throw new Error(`First action must target ${noopContract}, got ${first.account}`)
  }
  if (String(first.name) !== "noop") {
    throw new Error(`First action must be 'noop', got ${first.name}`)
  }
  const auth = first.authorization?.[0]
  if (!auth || String(auth.actor) !== cosignAccount || String(auth.permission) !== cosignPermission) {
    throw new Error(
      `First action authorization must be ${cosignAccount}@${cosignPermission}`,
    )
  }

  // Reject if any other action in the tx targets the cosign account itself
  // (defense: the cosign permission is linkauth-restricted to noop only, so
  // even on key compromise an attacker can't move funds; this is belt-and-braces).
  for (let i = 1; i < transaction.actions.length; i++) {
    const a = transaction.actions[i]
    if (String(a.account) === cosignAccount) {
      throw new Error("Actions cannot target the sponsor account")
    }
  }

  // Verify chainId is a real Checksum256 (catches obvious tampering)
  const cid = Checksum256.from(chainId)

  // Sign the digest of the EXACT bytes the user's wallet signed
  const cosignKey = PrivateKey.from(cosignPrivateKey)
  const cosignSig = cosignKey.signDigest(transaction.signingDigest(cid))

  // Verify the signature roundtrips to a valid string (sanity check)
  const sigStr = String(cosignSig)
  if (!sigStr.startsWith("SIG_")) {
    throw new Error("Cosign signature not in expected SIG_K1_... format")
  }

  return {
    signature: sigStr,
    noop: { account: noopContract, name: "noop", actor: cosignAccount, permission: cosignPermission },
  }
}

// Fetch chain info — used by /api/cosign to surface TAPOS the client can use.
// Kept here so the API route doesn't import wharfkit directly.
export async function fetchVaultaInfo() {
  const client = new APIClient({ url: VAULTA_RPC })
  const info = await client.v1.chain.get_info()
  return info
}

// Used by tests / probe scripts only.
export { Bytes, Serializer }

