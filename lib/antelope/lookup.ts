// Antelope account: 1-13 chars of a-z, 1-5, and dots (not starting/ending with dot)
const ACCOUNT_RE = /^[a-z1-5][a-z1-5.]{0,11}[a-z1-5]$|^[a-z1-5]$/
// 64-char hex = transaction ID
const TX_RE = /^[a-f0-9]{64}$/

export function isAccountName(text: string): boolean {
  return text.length >= 1 && text.length <= 13 && ACCOUNT_RE.test(text)
}

export function isTxId(text: string): boolean {
  return TX_RE.test(text)
}

// Strip @permission suffix (e.g. "account@active" → "account")
export function stripPermission(text: string): string {
  return text.split("@")[0]
}

export async function fetchAccountData(name: string, endpoint: string) {
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "account", id: name, endpoint }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lookup failed" }))
    throw new Error(err.error || "Lookup failed")
  }
  return res.json()
}

export async function fetchBlockData(blockNumOrId: string, endpoint: string) {
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "block", id: blockNumOrId, endpoint }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lookup failed" }))
    throw new Error(err.error || "Lookup failed")
  }
  return res.json()
}

export async function fetchTxData(
  txId: string,
  endpoint: string | null,
  hyperionEndpoint: string | null,
) {
  const ep = endpoint || hyperionEndpoint
  if (!ep) return null
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "transaction",
      id: txId,
      endpoint: endpoint || "",
      hyperionEndpoint: hyperionEndpoint || "",
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lookup failed" }))
    throw new Error(err.error || "Lookup failed")
  }
  return res.json()
}

export async function fetchTableData(
  code: string,
  table: string,
  endpoint: string,
  opts?: { scope?: string; lower_bound?: string; upper_bound?: string; reverse?: boolean },
) {
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "table",
      code,
      table,
      endpoint,
      scope: opts?.scope || code,
      ...(opts?.lower_bound ? { lower_bound: opts.lower_bound } : {}),
      ...(opts?.upper_bound ? { upper_bound: opts.upper_bound } : {}),
      ...(opts?.reverse ? { reverse: true } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lookup failed" }))
    throw new Error(err.error || "Lookup failed")
  }
  return res.json()
}

export async function fetchActionData(
  code: string,
  actionName: string,
  endpoint: string,
  initialValues?: Record<string, string>,
) {
  const res = await fetch("/api/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "abi", id: code, endpoint }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Lookup failed" }))
    throw new Error(err.error || "Lookup failed")
  }
  const { abi } = await res.json()
  if (!abi) throw new Error("No ABI found")
  const action = abi.actions?.find((a: { name: string }) => a.name === actionName)
  if (!action) throw new Error("Action not found in ABI")
  const struct = abi.structs?.find((s: { name: string }) => s.name === action.type)
  return {
    account_name: code,
    action_name: actionName,
    fields: struct?.fields || [],
    ...(initialValues ? { initialValues } : {}),
  }
}
