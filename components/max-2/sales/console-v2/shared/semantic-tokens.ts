/**
 * One source of truth for semantic color → token mapping across the sales
 * console. NEVER hardcode #92400e / #facc15 / #dc2626 etc. as theming on light
 * surfaces — map through here. All tokens are defined in styles/console-v2-sales.css
 * (scoped to .console-v2-sales-root) and resolve wherever that class is an ancestor.
 */

export type Severity = "success" | "warning" | "danger" | "info" | "brand" | "neutral";

export interface SeverityTokens {
  /** subtle background fill */
  fill: string;
  /** readable ink (text/icon) — for warning this is the dark ink, never raw yellow */
  ink: string;
  /** tinted hairline border */
  border: string;
}

export const SEVERITY: Record<Severity, SeverityTokens> = {
  success: { fill: "var(--spyne-success-subtle)", ink: "var(--spyne-success-text)", border: "color-mix(in srgb, var(--spyne-success-text) 22%, transparent)" },
  warning: { fill: "var(--spyne-warning-subtle)", ink: "var(--spyne-warning-ink)", border: "color-mix(in srgb, var(--spyne-warning-ink) 22%, transparent)" },
  danger: { fill: "var(--spyne-danger-subtle)", ink: "var(--spyne-danger-text)", border: "color-mix(in srgb, var(--spyne-danger-text) 22%, transparent)" },
  info: { fill: "var(--spyne-info-subtle)", ink: "var(--spyne-info-text)", border: "color-mix(in srgb, var(--spyne-info-text) 22%, transparent)" },
  brand: { fill: "var(--spyne-primary-soft)", ink: "var(--spyne-primary)", border: "var(--spyne-brand-muted)" },
  neutral: { fill: "var(--spyne-page-bg)", ink: "var(--spyne-text-secondary)", border: "var(--spyne-border)" },
};

/** Material Symbol ligature for each severity (banners/inline status). */
export const SEVERITY_GLYPH: Record<Severity, string> = {
  success: "check_circle",
  warning: "warning",
  danger: "error",
  info: "info",
  brand: "auto_awesome",
  neutral: "info",
};

/** Data-requirement tiers → severity (Required is a hard gate, Compliance a caution, Enriches a nicety). */
export const TIER_SEVERITY: Record<string, Severity> = {
  required: "danger",
  compliance: "warning",
  enriches: "info",
  recommended: "info",
  optional: "neutral",
};

export function tierSeverity(tier: string): Severity {
  return TIER_SEVERITY[tier.trim().toLowerCase()] ?? "neutral";
}
