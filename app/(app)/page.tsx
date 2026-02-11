"use client"

import { ChatPanel } from "@/components/chat/chat-panel"
import { DashboardView } from "@/components/dashboard/dashboard-view"
import { usePanels } from "@/lib/stores/panel-store"

export default function Home() {
  const { view } = usePanels()
  return (
    <>
      <div className={view === "chat" ? "flex flex-col flex-1 overflow-hidden" : "hidden"}>
        <ChatPanel />
      </div>
      {view === "dashboard" && <DashboardView />}
    </>
  )
}
