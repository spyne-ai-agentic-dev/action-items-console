"use client"

import { cn } from "@/lib/utils"

export type MaterialSymbolSize = 14 | 16 | 20 | 24

/**
 * Google Material Symbols Outlined (ligature name, e.g. `dashboard`, `photo_camera`).
 * Load the font from root layout — see `design-system/max-2.md`.
 */
export function MaterialSymbol({
  name,
  size = 20,
  className,
}: {
  name: string
  size?: MaterialSymbolSize
  className?: string
}) {
  return (
    <span
      className={cn(
        "material-symbols-outlined inline-flex shrink-0 items-center justify-center select-none",
        className
      )}
      style={{ fontSize: size, width: size, height: size, lineHeight: 1 }}
      aria-hidden
    >
      {name}
    </span>
  )
}
