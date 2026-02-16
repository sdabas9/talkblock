"use client"

import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { User, HardDrive, Cpu, Wifi, Key, Shield } from "lucide-react"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface AccountDetailProps {
  data: Record<string, any>
}

function ResourceDetail({ label, used, max, icon: Icon }: { label: string; used: number; max: number; icon: React.ElementType }) {
  const pct = max > 0 ? (used / max) * 100 : 0
  const formatBytes = (b: number) => {
    if (b >= 1048576) return (b / 1048576).toFixed(2) + " MB"
    if (b >= 1024) return (b / 1024).toFixed(2) + " KB"
    return b + " bytes"
  }
  const formatUs = (us: number) => {
    if (us >= 1000000) return (us / 1000000).toFixed(2) + " s"
    if (us >= 1000) return (us / 1000).toFixed(2) + " ms"
    return us + " \u00b5s"
  }
  const format = label === "RAM" ? formatBytes : formatUs

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          {label}
        </span>
        <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full"
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Used: {format(used)}</span>
        <span>Max: {format(max)}</span>
      </div>
    </div>
  )
}

export function AccountDetail({ data }: AccountDetailProps) {
  const ram = data.ram || { used: 0, quota: 0 }
  const cpu = data.cpu || { used: 0, available: 0, max: 0 }
  const net = data.net || { used: 0, available: 0, max: 0 }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5" />
        <h2 className="text-lg font-semibold">{data.account_name}</h2>
      </div>

      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-sm">{data.balance || "0"}</Badge>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Resources</h3>
        <ResourceDetail label="RAM" used={ram.used || 0} max={ram.quota || 0} icon={HardDrive} />
        <ResourceDetail label="CPU" used={cpu.used || 0} max={cpu.max || 0} icon={Cpu} />
        <ResourceDetail label="NET" used={net.used || 0} max={net.max || 0} icon={Wifi} />
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Staking</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">CPU Staked:</span>
            <p className="font-medium">{data.cpu_staked || "0"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">NET Staked:</span>
            <p className="font-medium">{data.net_staked || "0"}</p>
          </div>
        </div>
      </div>

      {data.permissions && data.permissions.length > 0 && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5" />
              Permissions
            </h3>
            {data.permissions.map((perm: any) => (
              <div key={perm.name} className="bg-muted rounded-md p-2 text-xs space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{perm.name}</Badge>
                  {perm.parent && <span className="text-muted-foreground">parent: {perm.parent}</span>}
                  <span className="text-muted-foreground">threshold: {perm.threshold}</span>
                </div>
                {(perm.keys || []).map((k: any, i: number) => (
                  <div key={i} className="flex items-center gap-1 text-muted-foreground pl-2">
                    <Key className="h-3 w-3" />
                    <span className="font-mono truncate">{k.key}</span>
                    <span>w:{k.weight}</span>
                  </div>
                ))}
                {(perm.accounts || []).map((a: any, i: number) => (
                  <div key={i} className="flex items-center gap-1 text-muted-foreground pl-2">
                    <User className="h-3 w-3" />
                    <span>{a.permission?.actor}@{a.permission?.permission}</span>
                    <span>w:{a.weight}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {data.voter_info && (
        <>
          <Separator />
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Voting</h3>
            <p className="text-xs text-muted-foreground">
              Staked: {data.voter_info.staked?.toLocaleString() || 0}
            </p>
            {data.voter_info.producers?.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.voter_info.producers.map((p: any) => (
                  <Badge key={p} variant="secondary" className="text-[10px]">{p}</Badge>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
