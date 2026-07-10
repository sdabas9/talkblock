"use client"

import { Component, ReactNode } from "react"

interface Props { children: ReactNode }
interface State { hasError: boolean }

// Contains renderer crashes so a corrupt bookmark can't take down the whole
// dashboard — the panel chrome (with its remove button) stays alive.
export class RendererBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="font-mono text-xs text-destructive uppercase tracking-widest">
          Render error — data may be malformed
        </div>
      )
    }
    return this.props.children
  }
}
