import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/chat", "/api/settings", "/api/bookmarks", "/api/conversations", "/api/credits", "/api/lookup", "/api/cosign"]

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
    // Deep links with chain param bypass login — login page will auto-connect
    const hasDeepLink = request.nextUrl.searchParams.has("chain") &&
      (request.nextUrl.searchParams.has("account") ||
       request.nextUrl.searchParams.has("block") ||
       request.nextUrl.searchParams.has("tx"))
    if (hasDeepLink) {
      return NextResponse.next()
    }
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
