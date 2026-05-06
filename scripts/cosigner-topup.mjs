#!/usr/bin/env node
// Cosigner topup cron — runs in GitHub Actions every 5 min.
// When talkblockpay's CPU usage hits >= 98% of its max, transfers 0.05 A to
// quickpowerup which dispatches an inline core.vaulta::powerup paid by itself.
// Memo "talkblockpay 98" tells quickpowerup to allocate 98% of the budget to
// CPU and 2% to NET. talkblockpay self-funds (5 A treasury seeded from rep).
//
// Required env: TOPUP_PRIVATE_KEY (talkblockpay@topup, linkauth-restricted to
// core.vaulta::transfer).

import {
  APIClient,
  PrivateKey,
  Action,
  Transaction,
  SignedTransaction,
  PackedTransaction,
} from "@wharfkit/antelope"

const RPC = "https://eos.greymass.com"
const TREASURY_ACCOUNT = "talkblockpay"
const TREASURY_PERMISSION = "topup"
const QUICKPOWERUP = "quickpowerup"
const TOKEN_CONTRACT = "core.vaulta"
const TOPUP_AMOUNT = "0.0500 A"   // 0.05 A per topup
const CPU_TRIGGER_PCT = 98         // fire at 98%+ used
const NET_TRIGGER_PCT = 98         // fire at 98%+ used (CPU is normally the binding side)
const CPU_PCT_MEMO = 98            // % of topup budget routed to CPU (rest to NET)
const LOW_BALANCE_WARN_A = 1.0     // warn when treasury < this many A
const EXPIRY_BUFFER_SEC = 3600     // refresh if powerup expires in < 1 hour

function pct(used, max) {
  return max > 0 ? (Number(used) / Number(max)) * 100 : 0
}

async function getAccountState(client, name) {
  const acct = await client.v1.chain.get_account(name)
  return {
    cpu_used: Number(acct.cpu_limit.used),
    cpu_max: Number(acct.cpu_limit.max),
    cpu_avail: Number(acct.cpu_limit.available),
    net_used: Number(acct.net_limit.used),
    net_max: Number(acct.net_limit.max),
    net_avail: Number(acct.net_limit.available),
  }
}

async function getABalance(client, name) {
  const balances = await client.v1.chain.get_currency_balance(TOKEN_CONTRACT, name, "A")
  return balances?.[0] ? Number(String(balances[0]).split(" ")[0]) : 0
}

// Query the quickpowerup contract's `powerups` table for the row keyed on
// `receiver`. Returns { exists, validUntilEpochSec, secondsUntilExpiry } or
// { exists: false } if no row (either never powered up via quickpowerup or
// the row was cleaned up after a previous expiry).
async function getQuickpowerupRow(client, receiver) {
  const res = await client.v1.chain.get_table_rows({
    code: QUICKPOWERUP,
    scope: QUICKPOWERUP,
    table: "powerups",
    lower_bound: receiver,
    upper_bound: receiver,
    json: true,
    limit: 1,
  })
  const row = res.rows?.[0]
  if (!row || row.receiver !== receiver) return { exists: false }
  // valid_until is "YYYY-MM-DDTHH:mm:ss" in UTC (no timezone suffix from the chain)
  const validUntilSec = Math.floor(new Date(row.valid_until + "Z").getTime() / 1000)
  const nowSec = Math.floor(Date.now() / 1000)
  return {
    exists: true,
    validUntilSec,
    secondsUntilExpiry: validUntilSec - nowSec,
  }
}

async function fireTopup(client, key) {
  const info = await client.v1.chain.get_info()
  const header = info.getTransactionHeader(120)
  const transferAbi = await client.v1.chain.get_abi(TOKEN_CONTRACT)

  const action = Action.from(
    {
      account: TOKEN_CONTRACT,
      name: "transfer",
      authorization: [{ actor: TREASURY_ACCOUNT, permission: TREASURY_PERMISSION }],
      data: {
        from: TREASURY_ACCOUNT,
        to: QUICKPOWERUP,
        quantity: TOPUP_AMOUNT,
        memo: `${TREASURY_ACCOUNT} ${CPU_PCT_MEMO}`,
      },
    },
    transferAbi.abi,
  )

  const tx = Transaction.from({ ...header, actions: [action] })
  const sig = key.signDigest(tx.signingDigest(info.chain_id))
  const signed = SignedTransaction.from({ ...tx, signatures: [sig] })
  const packed = PackedTransaction.fromSigned(signed, 0)

  const res = await fetch(`${RPC}/v1/chain/push_transaction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signatures: [String(sig)],
      compression: 0,
      packed_context_free_data: "",
      packed_trx: packed.packed_trx.hexString,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error?.what || body.error?.details?.[0]?.message || `push failed (${res.status})`)
  }
  return body.transaction_id || "(no id)"
}

async function main() {
  const ts = new Date().toISOString()
  const privKey = process.env.TOPUP_PRIVATE_KEY
  if (!privKey) {
    console.error(`${ts}  ERROR  TOPUP_PRIVATE_KEY env var missing`)
    process.exit(1)
  }
  const key = PrivateKey.from(privKey)
  const client = new APIClient({ url: RPC })

  const state = await getAccountState(client, TREASURY_ACCOUNT)
  const balance = await getABalance(client, TREASURY_ACCOUNT)
  const expiry = await getQuickpowerupRow(client, TREASURY_ACCOUNT)
  const cpuPct = pct(state.cpu_used, state.cpu_max)
  const netPct = pct(state.net_used, state.net_max)
  const expiryStr = expiry.exists
    ? `expires in ${expiry.secondsUntilExpiry}s`
    : "no quickpowerup row"

  console.log(
    `${ts}  ${TREASURY_ACCOUNT} CPU ${state.cpu_used}/${state.cpu_max}us (${cpuPct.toFixed(2)}%)  NET ${state.net_used}/${state.net_max}b (${netPct.toFixed(2)}%)  bal ${balance.toFixed(4)} A  ${expiryStr}`,
  )

  if (balance < LOW_BALANCE_WARN_A) {
    console.warn(
      `${ts}  WARNING  ${TREASURY_ACCOUNT} balance ${balance.toFixed(4)} A < ${LOW_BALANCE_WARN_A} A — refund from rep soon`,
    )
  }

  const cpuTrigger = cpuPct >= CPU_TRIGGER_PCT
  const netTrigger = netPct >= NET_TRIGGER_PCT
  const expiryTrigger =
    expiry.exists && expiry.secondsUntilExpiry < EXPIRY_BUFFER_SEC
  const triggers = [
    cpuTrigger && `cpu ${cpuPct.toFixed(1)}% >= ${CPU_TRIGGER_PCT}%`,
    netTrigger && `net ${netPct.toFixed(1)}% >= ${NET_TRIGGER_PCT}%`,
    expiryTrigger && `expires in ${expiry.secondsUntilExpiry}s < ${EXPIRY_BUFFER_SEC}s`,
  ].filter(Boolean)

  if (triggers.length === 0) {
    console.log(`${ts}  SKIP  no triggers (cpu<${CPU_TRIGGER_PCT}%, net<${NET_TRIGGER_PCT}%, expiry>${EXPIRY_BUFFER_SEC}s)`)
    return
  }
  console.log(`${ts}  TRIGGER  ${triggers.join(" | ")}`)
  if (balance < Number(TOPUP_AMOUNT.split(" ")[0])) {
    console.error(`${ts}  ERROR  cannot topup — balance ${balance.toFixed(4)} A < topup amount ${TOPUP_AMOUNT}`)
    process.exit(1)
  }

  console.log(`${ts}  TOPUP  firing transfer ${TOPUP_AMOUNT} -> ${QUICKPOWERUP} (memo "${TREASURY_ACCOUNT} ${CPU_PCT_MEMO}")`)
  try {
    const txid = await fireTopup(client, key)
    console.log(`${ts}  TOPUP  tx ${txid}`)
  } catch (e) {
    console.error(`${ts}  ERROR  topup failed: ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error("FATAL:", e instanceof Error ? e.message : String(e))
  process.exit(1)
})
