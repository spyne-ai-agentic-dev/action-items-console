import type React from "react"
import type { Metadata } from "next"
// Tailwind v4 + design tokens (powers the ported Action Items console AND the
// Settings screens). Dealer-onboarding tokens live in the @theme block at the
// end of this file. Loaded first so console.css below still governs the legacy
// shell (rail / submenu / panels) without being reset by Tailwind preflight.
import "./globals.css"
// Sales Console V2 component styles (scoped under `.console-v2-sales-root`) — powers the
// ported Action Items console. Safe to load globally; nothing outside that root is affected.
import "@/styles/console-v2-sales.css"
// Spyne legacy design system — the console shell's own stylesheet.
import "./console.css"

export const metadata: Metadata = {
  title: "Console · Retail Suite by Spyne",
  description: "Spyne Console — retail suite dashboard",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
