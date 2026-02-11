"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Box, Clock, User } from "lucide-react"
import { useDetailContext } from "@/lib/stores/context-store"

interface BlockCardProps {
  data: {
    block_num: number
    id: string
    timestamp: string
    producer: string
    transaction_count: number
  }
}

export function BlockCard({ data }: BlockCardProps) {
  const { setContext } = useDetailContext()

  return (
    <Card onClick={() => setContext("block", data)} className="my-2 max-w-md cursor-pointer hover:bg-accent/50 transition-colors">
      <CardHeader className="pb-2 pt-3 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Box className="h-4 w-4" />
          Block #{data.block_num.toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock className="h-3 w-3" />
          {data.timestamp}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="h-3 w-3" />
          Producer: {data.producer}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{data.transaction_count} transactions</Badge>
        </div>
        <div className="font-mono text-muted-foreground truncate text-[10px] pt-1">
          {data.id}
        </div>
      </CardContent>
    </Card>
  )
}
