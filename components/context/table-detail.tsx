"use client"

import React, { useState, useCallback, useEffect, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  TableIcon, Loader2, Search, ArrowDownUp,
  LayoutList, Table2, Columns3, ChevronDown, ChevronRight,
  Link2, Check, ChevronLeft,
} from "lucide-react"
import { useChain } from "@/lib/stores/chain-store"
import { useDetailContext } from "@/lib/stores/context-store"
import { fetchAccountData } from "@/lib/antelope/lookup"

const PAGE_SIZE = 20

interface TableDetailProps {
  data: {
    code?: string
    table?: string
    scope?: string
    lower_bound?: string
    upper_bound?: string
    reverse?: boolean
    rows: Array<Record<string, unknown>>
    more?: boolean
  }
}

type ViewMode = "table" | "cards"

export function TableDetail({ data: initialData }: TableDetailProps) {
  const { endpoint, chainName } = useChain()
  const { backToAccount, parentAccount, setContext } = useDetailContext()

  const goToAccount = useCallback(async () => {
    if (parentAccount) { backToAccount(); return }
    if (!initialData.code || !endpoint) return
    const accountData = await fetchAccountData(initialData.code, endpoint).catch(() => null)
    if (accountData) setContext("account", accountData)
  }, [parentAccount, backToAccount, initialData.code, endpoint, setContext])
  const [rows, setRows] = useState(initialData.rows || [])
  const [more, setMore] = useState(initialData.more ?? false)
  const [loading, setLoading] = useState(false)

  // Query controls
  const [scope, setScope] = useState(initialData.scope || initialData.code || "")
  const [lowerBound, setLowerBound] = useState(initialData.lower_bound || "")
  const [upperBound, setUpperBound] = useState(initialData.upper_bound || "")
  const [reverse, setReverse] = useState(initialData.reverse ?? false)

  // Sync query state back to context so expand/collapse preserves inputs and results
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setContext("table", {
      ...initialData,
      scope,
      lower_bound: lowerBound || undefined,
      upper_bound: upperBound || undefined,
      reverse,
      rows,
      more,
    })
  }, [scope, lowerBound, upperBound, reverse, rows]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pagination
  const [currentPage, setCurrentPage] = useState(0)

  // Share link
  const [linkCopied, setLinkCopied] = useState(false)

  // View controls
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const cols = (initialData.rows || [])[0]
    return cols && Object.keys(cols).length > 4 ? "cards" : "table"
  })
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    const cols = (initialData.rows || [])[0]
    if (!cols) return new Set<string>()
    const keys = Object.keys(cols)
    return new Set(keys.slice(0, 4))
  })
  const [showColPicker, setShowColPicker] = useState(false)
  const [expandedRow, setExpandedRow] = useState<number | null>(null)

  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  // Paginated rows
  const totalPages = Math.ceil(rows.length / PAGE_SIZE)
  const pagedRows = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)

  const fetchTable = async (opts?: { appendMode?: boolean; lb?: string }) => {
    if (!endpoint || !initialData.code || !initialData.table) return
    setLoading(true)
    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "table",
          code: initialData.code,
          table: initialData.table,
          scope: scope || initialData.code,
          endpoint,
          ...(opts?.lb ? { lower_bound: opts.lb } : lowerBound ? { lower_bound: lowerBound } : {}),
          ...(upperBound ? { upper_bound: upperBound } : {}),
          ...(reverse ? { reverse: true } : {}),
        }),
      })
      if (res.ok) {
        const result = await res.json()
        const newRows = (result.rows || []) as Array<Record<string, unknown>>
        if (opts?.appendMode && opts.lb) {
          const cols = rows.length > 0 ? Object.keys(rows[0]) : []
          const filtered = newRows.filter(
            (r) => cols[0] && String(r[cols[0]]) !== opts.lb
          )
          setRows((prev) => [...prev, ...filtered])
        } else {
          setRows(newRows)
          setCurrentPage(0)
          // Reset column picker for new data
          if (newRows.length > 0) {
            const newCols = Object.keys(newRows[0])
            setVisibleCols(new Set(newCols.slice(0, 4)))
          }
        }
        setMore(result.more ?? false)
        setExpandedRow(null)
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    if (rows.length === 0) return
    const lastRow = rows[rows.length - 1]
    const primaryKey = columns[0] ? String(lastRow[columns[0]] ?? "") : ""
    fetchTable({ appendMode: true, lb: primaryKey })
  }

  const toggleCol = (col: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev)
      if (next.has(col)) {
        if (next.size > 1) next.delete(col)
      } else {
        next.add(col)
      }
      return next
    })
  }

  const formatValue = (val: unknown) => {
    if (val === null || val === undefined) return ""
    if (typeof val === "object") return JSON.stringify(val, null, 2)
    return String(val)
  }

  const copyShareLink = () => {
    const params = new URLSearchParams()
    if (chainName) params.set("chain", chainName)
    if (initialData.code) params.set("code", initialData.code)
    if (initialData.table) params.set("table", initialData.table)
    if (scope && scope !== initialData.code) params.set("scope", scope)
    if (lowerBound) params.set("lower_bound", lowerBound)
    if (upperBound) params.set("upper_bound", upperBound)
    if (reverse) params.set("reverse", "true")
    const url = `${window.location.origin}/?${params.toString()}`
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const isWide = columns.length > 4

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <TableIcon className="h-5 w-5" />
        <h2 className="text-lg font-semibold truncate flex-1">
          {initialData.code && initialData.table
            ? <><button onClick={goToAccount} className="hover:underline cursor-pointer">{initialData.code}</button>{" / "}{initialData.table}</>
            : "Table Data"}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={copyShareLink}
          title="Copy shareable link"
        >
          {linkCopied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Link2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Query controls */}
      {initialData.code && initialData.table && (
        <>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-muted-foreground">Scope</label>
              <Input
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                placeholder={initialData.code || "scope"}
                className="h-7 text-xs font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground">Lower bound</label>
                <Input
                  value={lowerBound}
                  onChange={(e) => setLowerBound(e.target.value)}
                  placeholder="optional"
                  className="h-7 text-xs font-mono"
                />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground">Upper bound</label>
                <Input
                  value={upperBound}
                  onChange={(e) => setUpperBound(e.target.value)}
                  placeholder="optional"
                  className="h-7 text-xs font-mono"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={() => fetchTable()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Search className="h-3 w-3 mr-1" />
                )}
                Query
              </Button>
              <Button
                variant={reverse ? "secondary" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => setReverse(!reverse)}
                title={reverse ? "Reverse: ON" : "Reverse: OFF"}
              >
                <ArrowDownUp className="h-3 w-3" />
                {reverse ? "Rev" : "Fwd"}
              </Button>
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Current query badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="text-[10px] font-mono">
          scope: {scope || initialData.code || "?"}
        </Badge>
        {reverse && (
          <Badge variant="secondary" className="text-[10px] font-mono">
            reverse
          </Badge>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rows found</p>
      ) : (
        <>
          {/* View mode + column controls */}
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {rows.length} row{rows.length !== 1 ? "s" : ""} · {columns.length} col{columns.length !== 1 ? "s" : ""}
            </div>
            <div className="flex items-center gap-1">
              {viewMode === "table" && isWide && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => setShowColPicker(!showColPicker)}
                  title="Choose columns"
                >
                  <Columns3 className="h-3 w-3" />
                </Button>
              )}
              <Button
                variant={viewMode === "table" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setViewMode("table")}
                title="Table view"
              >
                <Table2 className="h-3 w-3" />
              </Button>
              <Button
                variant={viewMode === "cards" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setViewMode("cards")}
                title="Card view"
              >
                <LayoutList className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Column picker dropdown */}
          {showColPicker && viewMode === "table" && (
            <div className="flex flex-wrap gap-1">
              {columns.map((col) => (
                <button
                  key={col}
                  onClick={() => toggleCol(col)}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    visibleCols.has(col)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {col}
                </button>
              ))}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === "table" && (
            <div className="overflow-auto -mx-4 px-4" style={{ maxHeight: "calc(100vh - 320px)" }}>
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10 bg-background">
                  <tr className="border-b">
                    {columns.filter((c) => !isWide || visibleCols.has(c)).map((col) => (
                      <th
                        key={col}
                        className="px-2 py-1.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                    {isWide && visibleCols.size < columns.length && (
                      <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">
                        ...
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row, i) => {
                    const globalIdx = currentPage * PAGE_SIZE + i
                    return (
                      <React.Fragment key={globalIdx}>
                        <tr
                          className={`border-b last:border-0 ${isWide ? "cursor-pointer hover:bg-accent/30" : ""}`}
                          onClick={isWide ? () => setExpandedRow(expandedRow === globalIdx ? null : globalIdx) : undefined}
                        >
                          {columns.filter((c) => !isWide || visibleCols.has(c)).map((col) => (
                            <td key={col} className="px-2 py-1.5 whitespace-nowrap max-w-[140px] truncate">
                              {typeof row[col] === "object" && row[col] !== null
                                ? JSON.stringify(row[col])
                                : String(row[col] ?? "")}
                            </td>
                          ))}
                          {isWide && visibleCols.size < columns.length && (
                            <td className="px-2 py-1.5 text-muted-foreground">
                              {expandedRow === globalIdx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            </td>
                          )}
                        </tr>
                        {expandedRow === globalIdx && (
                          <tr key={`${globalIdx}-exp`} className="border-b">
                            <td colSpan={columns.filter((c) => !isWide || visibleCols.has(c)).length + (isWide ? 1 : 0)} className="p-0">
                              <div className="bg-muted/50 px-3 py-2 space-y-1">
                                {columns.map((col) => (
                                  <div key={col} className="flex gap-2 text-xs">
                                    <span className="text-muted-foreground font-medium shrink-0 w-24 truncate" title={col}>{col}</span>
                                    <span className="font-mono break-all whitespace-pre-wrap">
                                      {formatValue(row[col])}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CARD VIEW */}
          {viewMode === "cards" && (
            <div className="space-y-2">
              {pagedRows.map((row, i) => (
                <div key={currentPage * PAGE_SIZE + i} className="rounded-md border bg-card p-3 space-y-1.5 text-xs">
                  {columns[0] && (
                    <div className="font-medium text-sm pb-1 border-b">
                      {String(row[columns[0]] ?? `Row ${currentPage * PAGE_SIZE + i + 1}`)}
                    </div>
                  )}
                  {columns.slice(columns[0] ? 1 : 0).map((col) => (
                    <div key={col} className="flex gap-2">
                      <span className="text-muted-foreground shrink-0 w-28 truncate" title={col}>
                        {col}
                      </span>
                      {typeof row[col] === "object" && row[col] !== null ? (
                        <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap break-all flex-1">
                          {JSON.stringify(row[col], null, 2)}
                        </pre>
                      ) : (
                        <span className="font-mono break-all flex-1">{String(row[col] ?? "")}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => { setCurrentPage((p) => Math.max(0, p - 1)); setExpandedRow(null) }}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-3 w-3" />
                Prev
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={() => { setCurrentPage((p) => Math.min(totalPages - 1, p + 1)); setExpandedRow(null) }}
                disabled={currentPage >= totalPages - 1}
              >
                Next
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {more && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          )}
        </>
      )}
    </div>
  )
}
