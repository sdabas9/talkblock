import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Talkblock",
  description: "Chat-first Antelope blockchain explorer",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <style dangerouslySetInnerHTML={{ __html: `
          html.shared-link [data-left-panel] { display: none !important; }
          html.shared-link [data-main-content] { display: none !important; }
          html.shared-link [data-right-panel] { flex: 1 !important; width: 100% !important; }
        `}} />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var t = localStorage.getItem('theme') || 'dark';
            var all = ['dark','dim','dusk'];
            document.documentElement.classList.remove.apply(document.documentElement.classList, all);
            if (t !== 'light' && all.indexOf(t) !== -1) document.documentElement.classList.add(t);
            var p = new URLSearchParams(window.location.search);
            if (p.get('account') || p.get('tx') || p.get('block') || (p.get('table') && p.get('code')) || (p.get('action') && p.get('code'))) {
              document.documentElement.classList.add('shared-link');
            }
          })();
        `}} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  )
}
