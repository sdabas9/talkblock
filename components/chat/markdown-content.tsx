"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { isAccountName, isTxId, stripPermission, fetchAccountData, fetchTxData } from "@/lib/antelope/lookup"

interface MarkdownContentProps {
  content: string
}

export function MarkdownContent({ content }: MarkdownContentProps) {
  const { endpoint, hyperionEndpoint } = useChain()
  const { setContext } = useDetailContext()

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
