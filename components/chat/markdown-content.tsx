"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { isAccountName, isTxId, stripPermission, fetchAccountData, fetchTxData } from "@/lib/antelope/lookup"

interface TableRef {
  code?: unknown
  table?: unknown
  scope?: unknown
  rows?: unknown
  more?: unknown
  [key: string]: unknown
}

interface AbiRef {
  account_name?: unknown
  tables?: unknown[]
  [key: string]: unknown
}

interface MarkdownContentProps {
  content: string
  tableRefs?: TableRef[]
  abiRefs?: AbiRef[]
}

export function MarkdownContent({ content, tableRefs = [], abiRefs = [] }: MarkdownContentProps) {
  const { endpoint, hyperionEndpoint } = useChain()
  const { setContext } = useDetailContext()

  const findTableRef = (text: string): TableRef | undefined => {
    return tableRefs.find(
      (t) => String(t.table || "") === text || String(t.code || "") === text
    )
  }

  const findAbiTable = (text: string): { code: string; table: string } | undefined => {
    for (const abi of abiRefs) {
      const tables = abi.tables as string[] | undefined
      const code = String(abi.account_name || "")
      if (code && tables?.includes(text)) {
        return { code, table: text }
      }
    }
    return undefined
  }

  const findAbiAction = (text: string): { account_name: string; action_name: string; fields: Array<{ name: string; type: string }> } | undefined => {
    for (const abi of abiRefs) {
      const actions = abi.actions as string[] | undefined
      const structs = abi.structs as Array<{ name: string; fields: Array<{ name: string; type: string }> }> | undefined
      const code = String(abi.account_name || "")
      if (code && actions?.includes(text)) {
        const struct = structs?.find((s) => s.name === text)
        return { account_name: code, action_name: text, fields: struct?.fields || [] }
      }
    }
    return undefined
  }

  const lookupTable = async (code: string, table: string) => {
    if (!endpoint) return
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "table", code, table, scope: code, endpoint }),
      })
      if (res.ok) {
        const data = await res.json()
        setContext("table", { code, table, scope: code, ...data })
      }
    } catch { /* ignore */ }
  }

  const lookupAccount = async (name: string) => {
    if (!endpoint) { console.warn("lookupAccount: no endpoint"); return }
    try {
      const data = await fetchAccountData(name, endpoint)
      setContext("account", data)
    } catch (e) { console.error("lookupAccount failed:", e) }
  }

  const lookupTx = async (txId: string) => {
    try {
      const data = await fetchTxData(txId, endpoint, hyperionEndpoint)
      if (data) setContext("transaction", data)
    } catch (e) { console.error("lookupTx failed:", e) }
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        pre: ({ children }) => (
          <pre className="bg-background/50 rounded-md p-3 overflow-x-auto my-2 text-xs">
            {children}
          </pre>
        ),
        code: ({ children, className, node, ...rest }) => {
          // In react-markdown v10, inline code has no className and is not inside a <pre>
          const isBlock = className || (node?.position && rest && "inline" in rest && !rest.inline)
          if (!isBlock) {
            const raw = String(children).trim()
            const text = stripPermission(raw) // handle "account@active"
            if (isTxId(text)) {
              return (
                <code
                  className="bg-background/50 px-1 py-0.5 rounded text-xs text-primary cursor-pointer"
                  onClick={() => lookupTx(text)}
                  title="View transaction details"
                >
                  {children}
                </code>
              )
            }
            const tableMatch = findTableRef(text)
            if (tableMatch) {
              return (
                <code
                  className="bg-background/50 px-1 py-0.5 rounded text-xs text-primary cursor-pointer"
                  onClick={() => setContext("table", tableMatch)}
                  title="View table data"
                >
                  {children}
                </code>
              )
            }
            const abiMatch = findAbiTable(text)
            if (abiMatch) {
              return (
                <code
                  className="bg-background/50 px-1 py-0.5 rounded text-xs text-primary cursor-pointer"
                  onClick={() => lookupTable(abiMatch.code, abiMatch.table)}
                  title={`Query ${abiMatch.code} / ${abiMatch.table}`}
                >
                  {children}
                </code>
              )
            }
            const actionMatch = findAbiAction(text)
            if (actionMatch) {
              return (
                <code
                  className="bg-background/50 px-1 py-0.5 rounded text-xs text-primary cursor-pointer"
                  onClick={() => setContext("action", actionMatch)}
                  title={`Execute ${actionMatch.account_name}::${actionMatch.action_name}`}
                >
                  {children}
                </code>
              )
            }
            if (isAccountName(text)) {
              return (
                <code
                  className="bg-background/50 px-1 py-0.5 rounded text-xs text-primary cursor-pointer"
                  onClick={() => lookupAccount(text)}
                  title="View account details"
                >
                  {children}
                </code>
              )
            }
            return (
              <code className="bg-background/50 px-1 py-0.5 rounded text-xs">
                {children}
              </code>
            )
          }
          return <code className={className}>{children}</code>
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-border px-2 py-1 text-left font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-border px-2 py-1">{children}</td>
        ),
        a: ({ children, href }) => (
          <a
            href={href}
            className="text-primary underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        ul: ({ children }) => (
          <ul className="list-disc pl-4 my-1 space-y-0.5">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal pl-4 my-1 space-y-0.5">{children}</ol>
        ),
        strong: ({ children }) => {
          const raw = String(children).trim()
          const text = stripPermission(raw)
          const strongTableMatch = findTableRef(text)
          if (strongTableMatch) {
            return (
              <strong
                className="text-primary cursor-pointer"
                onClick={() => setContext("table", strongTableMatch)}
                title="View table data"
              >
                {children}
              </strong>
            )
          }
          const strongAbiMatch = findAbiTable(text)
          if (strongAbiMatch) {
            return (
              <strong
                className="text-primary cursor-pointer"
                onClick={() => lookupTable(strongAbiMatch.code, strongAbiMatch.table)}
                title={`Query ${strongAbiMatch.code} / ${strongAbiMatch.table}`}
              >
                {children}
              </strong>
            )
          }
          const strongActionMatch = findAbiAction(text)
          if (strongActionMatch) {
            return (
              <strong
                className="text-primary cursor-pointer"
                onClick={() => setContext("action", strongActionMatch)}
                title={`Execute ${strongActionMatch.account_name}::${strongActionMatch.action_name}`}
              >
                {children}
              </strong>
            )
          }
          if (isTxId(text)) {
            return (
              <strong
                className="text-primary cursor-pointer"
                onClick={() => lookupTx(text)}
                title="View transaction details"
              >
                {children}
              </strong>
            )
          }
          if (isAccountName(text)) {
            return (
              <strong
                className="text-primary cursor-pointer"
                onClick={() => lookupAccount(text)}
                title="View account details"
              >
                {children}
              </strong>
            )
          }
          return <strong>{children}</strong>
        },
        p: ({ children }) => <p className="my-1">{children}</p>,
        h1: ({ children }) => (
          <h1 className="text-base font-bold mt-3 mb-1">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold mt-2 mb-1">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
