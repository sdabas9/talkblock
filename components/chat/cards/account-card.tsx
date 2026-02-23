"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { User, HardDrive, Cpu, Wifi } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"

interface AccountCardProps {
  data: {
    account_name: string
    balance: string
    ram: { used: number; quota: number }
    cpu: { used: number; available: number; max: number }
    net: { used: number; available: number; max: number }
    cpu_staked: string
    net_staked: string
    rex?: { rex_balance: string; vote_stake: string; matured_rex: number } | null
    rex_fund?: string | null
  }
}

function ResourceBar({ used, max, label, icon: Icon }: { used: number; max: number; label: string; icon: React.ElementType }) {
  const pct = max > 0 ? (used / max) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-muted-foreground">
          <Icon className="h-3 w-3" />
          {label}
        </span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  )
}

export function AccountCard({ data }: AccountCardProps) {
  const { setContext } = useDetailContext()

  return (
    <Card onClick={() => setContext("account", data)} className="my-2 max-w-md cursor-pointer hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <User className="h-4 w-4" />
          {data.account_name}
          <Badge variant="secondary" className="ml-auto text-xs">{data.balance}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        <ResourceBar used={data.ram.used} max={data.ram.quota} label="RAM" icon={HardDrive} />
        <ResourceBar used={data.cpu.used} max={data.cpu.max} label="CPU" icon={Cpu} />
        <ResourceBar used={data.net.used} max={data.net.max} label="NET" icon={Wifi} />
        <div className="flex gap-4 text-xs text-muted-foreground pt-1">
          <span>CPU Staked: {data.cpu_staked}</span>
          <span>NET Staked: {data.net_staked}</span>
        </div>
        {data.rex && (
          <div className="flex gap-4 text-xs text-muted-foreground">
            <span>REX: {data.rex.rex_balance}</span>
            <span>Vote Stake: {data.rex.vote_stake}</span>
            {data.rex_fund && <span>REX Fund: {data.rex_fund}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
