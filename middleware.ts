import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/chat", "/api/settings", "/api/bookmarks", "/api/conversations"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public paths and API routes
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  // Check if user has selected a chain
  const chainSelected = request.cookies.get("chain_selected")?.value
  if (!chainSelected) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
