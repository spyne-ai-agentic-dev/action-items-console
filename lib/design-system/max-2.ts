/**
 * Spyne Console design system for Max 2.0.
 *
 * CSS variables and `.max2-spyne` rules: `app/globals.css`
 * Human spec: `design-system/max-2.md`
 *
 * The Max 2 shell (`/max-2` and below) is wrapped in `Max2SpyneScope` in `app/max-2/layout.tsx`.
 */

/** Raw token strings for tests, charts, or non-Tailwind contexts */
export const spyneConsoleTokens = {
  primary: "#4600F2",
  primarySoft: "#4600F214",
  pageBackground: "#F4F5F8",
  surface: "#FFFFFF",
  textPrimary: "#1A1A1A",
  textSecondary: "#6B7280",
  border: "#E5E7EB",
  success: "#027A48",
  warning: "#FACC15",
  error: "#D13313",
  info: "#3B82F6",
  /** Inferred — hover on primary CTA */
  primaryHover: "#3B00D1",
  /** Inferred — pressed primary */
  primaryPressed: "#3200B8",
  /** Inferred — disabled control surface */
  disabledBg: "#F3F4F6",
  /** Inferred — disabled label */
  disabledText: "#9CA3AF",
  /** Inferred — warning label on white (pairs with `warning`; matches `.spyne-badge-warning` text) */
  warningInk: "#854D0E",
  /** Extended chip tones (see `.spyne-ds-chip` in `app/globals.css`) */
  chipNeutral: "#64748B",
  chipCharcoal: "#374151",
  chipCyan: "#0891B2",
  chipPink: "#DB2777",
  chipOrange: "#EA580C",
  chipCrimson: "#B91C1C",
  chipRose: "#E11D48",
} as const

/**
 * Dark elevated UI — tooltips and chart popovers on near-black surfaces (`--spyne-dark-elevated-bg`).
 * Series colors are lighter than light-theme semantics so copy stays readable (WCAG contrast on #1E1E1E).
 * Use `spyneDarkUiTokens.chartSeries` / CSS `var(--spyne-chart-on-dark-*)` — not `spyneConsoleTokens.success` etc. for text on dark.
 */
/**
 * Dark tooltip shell (Publish column, holding cost, lot KPI). CSS: `--spyne-tooltip-dark-*` in `app/globals.css`.
 * Inner panels may use `--spyne-dark-elevated-bg` for nested wells.
 */
export const spyneDarkTooltipTokens = {
  shellBackground: "#121212",
  shellBackgroundVar: "var(--spyne-tooltip-dark-shell-bg)",
  labelMuted: "#888888",
  labelMutedVar: "var(--spyne-tooltip-dark-label-muted)",
  shadowVar: "var(--spyne-tooltip-dark-shadow)",
} as const

export const spyneDarkUiTokens = {
  elevatedBackground: "#1E1E1E",
  text: "#F3F4F6",
  textMuted: "#9CA3AF",
  chartSeries: [
    "#B794F6",
    "#7EB6FF",
    "#6EE7A0",
    "#22D3EE",
    "#F472B6",
    "#FDBA74",
    "#F87171",
    "#FCD34D",
  ],
} as const

/**
 * Card shell tokens — Studio / Lot (shadcn `Card` under `.max2-spyne`) and Sales (`.spyne-card`).
 * Values mirror `:root` in `app/globals.css` (`--spyne-card-*`).
 * Layout: no hairline between card title block and body — see `design-system/max-2.md` § Cards; `.max2-spyne [data-slot="card-header"]` omits `border-bottom` in `app/globals.css`.
 *
 * Card title canonical style: 15px / 600 / 1.2 line-height.
 * Always use `<CardTitle>` (shadcn) or `spyneComponentClasses.cardTitle` — never raw `font-semibold` without an explicit size.
 */
export const spyneCardTokens = {
  radius: "var(--spyne-card-radius)",
  border: "var(--spyne-card-border)",
  background: "var(--spyne-card-bg)",
  shadow: "var(--spyne-card-shadow)",
  gap: "var(--spyne-card-gap)",
  paddingX: "var(--spyne-card-padding-x)",
  headerPaddingTop: "var(--spyne-card-header-padding-top)",
  headerPaddingBottom: "var(--spyne-card-header-padding-bottom)",
  contentPaddingBottom: "var(--spyne-card-content-padding-bottom)",
  titleFontSize: "var(--spyne-card-title-font-size)",
  titleFontWeight: "var(--spyne-card-title-font-weight)",
  titleLineHeight: "var(--spyne-card-title-line-height)",
  titleColor: "var(--spyne-card-title-color)",
  descriptionFontSize: "var(--spyne-card-description-font-size)",
  descriptionLineHeight: "var(--spyne-card-description-line-height)",
  descriptionColor: "var(--spyne-card-description-color)",
} as const

/**
 * Toolbar controls — segmented switcher + filter dropdown trigger (Sales overview).
 * Values mirror `:root` in `app/globals.css` (`--spyne-toolbar-*`).
 */
/** Line (underline) tabs — `spyne-line-tab-strip` + `spyne-line-tab*` in `app/globals.css` */
export const spyneLineTabTokens = {
  fontSize: "var(--spyne-line-tab-font-size)",
  fontSizeCompact: "var(--spyne-line-tab-font-size-compact)",
  indicatorWidth: "var(--spyne-line-tab-indicator-width)",
  paddingX: "var(--spyne-line-tab-padding-x)",
  paddingBottom: "var(--spyne-line-tab-padding-bottom)",
  gap: "var(--spyne-line-tab-gap)",
  stripColumnGap: "var(--spyne-line-tab-strip-column-gap)",
  salesStackGap: "var(--spyne-sales-stack-gap)",
} as const

/** Sales Console V2 vertical rhythm — use with `space-y-6` / strip margin */
export const spyneSalesLayout = {
  /** Same vertical rhythm as `max2Layout.pageStack` — see `.spyne-max2-page-stack` in `app/globals.css` */
  pageStack: "spyne-max2-page-stack",
  /** Match `--spyne-sales-stack-gap` (24px) */
  sectionGap: "gap-6",
  /**
   * Sales / Service overview row: agent summary, upcoming appointments, priority follow-ups.
   * Same breakpoints as the inbound Sales overview (`md`: three columns).
   */
  overviewAgentRow: "grid grid-cols-1 md:grid-cols-3",
} as const

export const spyneToolbarTokens = {
  controlHeight: "var(--spyne-toolbar-control-height)",
  controlRadius: "var(--spyne-toolbar-control-radius)",
  controlGap: "var(--spyne-toolbar-control-gap)",
  segmentPaddingX: "var(--spyne-toolbar-segment-padding-x)",
  segmentedActiveBg: "var(--spyne-primary-soft)",
  segmentedActiveText: "var(--spyne-primary)",
  segmentedInactiveText: "var(--spyne-text-secondary)",
} as const

/**
 * Checkbox — shadcn `Checkbox` under `.max2-spyne` (see `app/globals.css` `[data-slot="checkbox"]`).
 * Checked fill uses canonical `--spyne-primary`; check mark is white with rounded stroke caps.
 */
export const spyneCheckboxTokens = {
  size: "var(--spyne-checkbox-size)",
  radius: "var(--spyne-checkbox-radius)",
  checkIconSize: "var(--spyne-checkbox-check-size)",
  checkStroke: "var(--spyne-checkbox-check-stroke)",
  checkedBackground: "var(--spyne-primary)",
  checkedBackgroundHover: "var(--spyne-primary-hover)",
  checkColor: "#FFFFFF",
} as const

/** Chip visual emphasis (matches Figma-style reference: outline → soft → solid) */
export type SpyneChipVariant = "outline" | "soft" | "solid"

/** Chip color family — core semantic tokens + extended palette */
export type SpyneChipTone =
  | "neutral"
  | "charcoal"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "primary"
  | "cyan"
  | "pink"
  | "orange"
  | "crimson"
  | "rose"

/** Root + modifiers for custom markup (prefer `<SpyneChip />`) */
export function spyneDsChipClassName(opts: { variant: SpyneChipVariant; tone: SpyneChipTone }) {
  return `spyne-ds-chip spyne-ds-chip--${opts.variant} spyne-ds-chip--${opts.tone}`
}

export const spyneDsChipIconClass = "spyne-ds-chip__icon"

/** Numeric count pill inside `SpyneChip` (e.g. inventory quick filters) */
export const spyneDsChipMetricClass = "spyne-ds-chip__metric"

export const spyneDsChipCompactClass = "spyne-ds-chip--compact"

/** White/surface fill + primary border and text (active filter bar chips) */
export const spyneDsChipFilterRowClass = "spyne-ds-chip--filter-row"

export const max2Tokens = {
  /** Main column: 32px top; 24px left, right, bottom */
  pagePaddingTop: "32px",
  pagePadding: "24px",
  shellBackground: spyneConsoleTokens.pageBackground,
} as const

/** Class names from `@layer components` in globals.css */
export const max2Classes = {
  pageTitle: "max2-page-title",
  pageDescription: "max2-page-description",
  /** Section heading below the page title (14px / 600, Spyne text) */
  sectionTitle: "text-sm font-semibold text-spyne-text leading-snug tracking-tight",
  /** Applied by `Max2SpyneScope` — do not repeat on children */
  spyneScope: "max2-spyne",
  navActive: "max2-nav-active",
  navChildActive: "max2-nav-child-active",
  /**
   * Sticky shell for **Studio AI**, **Sales**, and **Service** secondary nav.
   * Pair with `SpyneLineTabStrip` + `embedded` and `px-max2-page` on the inner wrapper.
   * Height follows the tab strip (no fixed `h-14`) so there is no empty band **below** the strip hairline inside the white block.
   */
  moduleSecondaryNavShell:
    "flow-root sticky top-14 z-[40] lg:top-0 w-full min-w-0 shrink-0 bg-spyne-surface pt-4",
  /**
   * Full-width hairline under {@link moduleSecondaryNavShell} line tabs. Use with tab strip
   * `!border-b-0` so the rule spans the module column edge-to-edge (not inset by `px-max2-page`).
   */
  studioInventoryTabHairline: "h-px w-full min-w-0 shrink-0 bg-spyne-border",
  /**
   * Main column under **Sales / Service** secondary nav: horizontal gutters, bottom padding, light top inset.
   * Sticky page headers still supply their own `pt-4`; this `pt-2` aligns with extra main-column top air.
   */
  moduleSecondaryNavPageBody: "px-max2-page pb-6 pt-2",
  /**
   * **Studio AI** layout under secondary nav: top inset so page titles clear the hairline (matches extra main-column top air).
   */
  moduleSecondaryNavPageBodyStudio:
    "px-max2-page pb-6 pt-[var(--max2-studio-module-body-padding-top)]",
  /**
   * Vehicle display: title + meta block inside {@link moduleSecondaryNavShell} when merged with
   * `StudioInventoryLineTabs` on the VDP route (see `vehicle-display-page.tsx`).
   */
  vehicleDisplayPageStickyInner: "px-max2-page pt-4 pb-4",
  /**
   * **Overview panel shell** — plain `div` cards on Studio AI / Media Lot overview (Action Items, Inventory Analysis, age distribution, etc.).
   * Do **not** use shadcn `Card`; pair with `overviewPanelHeader`, `overviewPanelDescription`, and a body sibling `<div>`.
   * @see design-system/max-2.md — Overview panel shell (Studio & Lot)
   */
  overviewPanelShell:
    "rounded-xl border border-spyne-border bg-spyne-surface shadow-none overflow-hidden",
  /**
   * Heading block inside {@link overviewPanelShell}: **20px** on all sides (`px-5` / `pt-5` / `pb-5`).
   * Horizontal inset matches vertical band below the subtitle (before tabs/table).
   */
  overviewPanelHeader: "px-5 pt-5 pb-5",
  /** Subtitle under `spyneComponentClasses.cardTitle` — **14px**, secondary, **8px** below title */
  overviewPanelDescription: "text-sm mt-2 text-muted-foreground",
  /** Full-width slab below a table (insights, dual callouts): top rule + **20px** horizontal + **16px** top / **20px** bottom */
  overviewPanelFooter: "border-t border-spyne-border px-5 pt-4 pb-5",
  /** Single-row footer (e.g. “View all” link bar): **16px** vertical */
  overviewPanelFooterRow: "border-t border-spyne-border px-5 py-4",
  /**
   * Use with {@link overviewPanelShell} when a child paints outside the default clip (e.g. {@link overviewSuggestBannerPointer}).
   */
  overviewPanelShellAllowOverflow: "overflow-visible",
  /**
   * **Action Items** suggest slab under {@link Max2ActionTabStrip} (Lot Overview): `spyne-row-warn`, **8px** radius, border, copy + primary CTA row.
   * @see design-system/max-2.md — Overview suggest banner (Lot)
   */
  overviewSuggestBanner:
    "spyne-row-warn rounded-lg border border-spyne-border px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4",
  /**
   * Merchandising “instant media” pitch (Studio): layout matches {@link overviewSuggestBanner}.
   * Surface is a **local CSS override** (bold gradient), see `.spyne-merch-pitch-banner--instant` in `app/globals.css`.
   */
  merchandisingInstantPitchBanner:
    "spyne-merch-pitch-banner--instant rounded-lg border border-spyne-border px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4",
  /** Icon + body copy row inside {@link overviewSuggestBanner}. */
  overviewSuggestBannerContent: "flex min-w-0 flex-1 items-start gap-3",
  /** Positioning root for the suggest banner and tab pointer; must wrap both. */
  overviewSuggestBannerAnchor: "spyne-overview-suggest-banner__anchor",
  /**
   * Tooltip-style pointer toward the active action tab. Pair with `spyne-row-warn` for surface; set `left` inline.
   */
  overviewSuggestBannerPointer:
    "spyne-overview-suggest-banner__pointer spyne-row-warn -translate-x-1/2",
  /** Vertical gap before `VehicleMediaTable` after the suggest banner. */
  overviewSuggestBannerTableGap: "pt-8",
} as const

/** Semantic badge/chip utilities (inside `.max2-spyne` only) */
export const spyneComponentClasses = {
  btnPrimaryLg: "spyne-btn-primary-lg",
  btnPrimaryMd: "spyne-btn-primary-md",
  btnSecondaryMd: "spyne-btn-secondary-md",
  chip: "spyne-chip",
  chipFilter: "spyne-chip-filter",
  badgeBrand: "spyne-badge-brand",
  badgeSuccess: "spyne-badge-success",
  badgeWarning: "spyne-badge-warning",
  badgeError: "spyne-badge-error",
  /** Alias of `badgeError` — legacy sales markup */
  badgeDanger: "spyne-badge-danger",
  badgeInfo: "spyne-badge-info",
  /** Retail / orange emphasis — pairs with `--spyne-chip-orange` in `app/globals.css` */
  badgeOrange: "spyne-badge-orange",
  badgeNeutral: "spyne-badge-neutral",
  /**
   * Layout shell for status pills: pair with {@link badgeSuccess}, {@link badgeInfo}, etc.
   * CSS: `.spyne-badge-*` in `app/globals.css`.
   */
  badgePillInline: "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
  rowSelected: "spyne-row-selected",
  rowWarn: "spyne-row-warn",
  rowError: "spyne-row-error",
  /**
   * Studio / Lot **overview** tables and lists: draw attention without a full-row red wash.
   * Use instead of `rowError` on `/max-2/studio` and `/max-2/lot-view` overview surfaces.
   */
  overviewIssueRowAccent: "border-l-[3px] border-l-spyne-error",
  /** Subtle positive highlight (e.g. fresh trade-in) */
  rowPositive: "spyne-row-positive",
  /**
   * Insight rows — light tinted list rows (Studio Insights card, modal “Actions required” links).
   * CSS: `.spyne-insight-row*` under `.max2-spyne` in `app/globals.css`. No shadows; semantic icon wells only.
   */
  insightRow: "spyne-insight-row",
  /** Dense horizontal row (`<a>`): add with `insightRow` */
  insightRowCompact: "spyne-insight-row--compact",
  insightRowBody: "spyne-insight-row__body",
  insightRowIconWell: "spyne-insight-row__icon-well",
  insightRowIconWellWarning: "spyne-insight-row__icon-well--warning",
  insightRowIconWellCritical: "spyne-insight-row__icon-well--critical",
  /** Positive / upside signals (e.g. dashboard Opportunities rows) */
  insightRowIconWellSuccess: "spyne-insight-row__icon-well--success",
  insightRowIconWellCompact: "spyne-insight-row__icon-well--compact",
  insightRowMain: "spyne-insight-row__main",
  insightRowTitleRow: "spyne-insight-row__title-row",
  insightRowTitle: "spyne-insight-row__title",
  insightRowMeta: "spyne-insight-row__meta",
  insightRowChevron: "spyne-insight-row__chevron",
  kpiIcon: "spyne-kpi-icon",
  /** Card section title — same typography as shadcn `CardTitle`; use inside `.spyne-card` or under `.max2-spyne` */
  cardTitle: "spyne-card-title",
  /** Segmented switcher (mutually exclusive options) — container */
  segmented: "spyne-segmented",
  /** Use with {@link segmented} for a taller control with 15px labels (e.g. Studio table view toggle) */
  segmentedLg: "spyne-segmented--lg",
  /** Segment button — use with `aria-pressed` for active state */
  segmentedBtn: "spyne-segmented__btn",
  /** Status dot before segment label (offline / muted) */
  segmentedDot: "spyne-segmented__dot",
  /** Live / online indicator */
  segmentedDotLive: "spyne-segmented__dot--live",
  /** Wrapper for native `<select>` + chevron */
  filterSelectWrap: "spyne-filter-select-wrap",
  /** Native select or text field styled as toolbar filter */
  filterSelect: "spyne-filter-select",
  /** Absolutely positioned chevron — sibling after `<select>` */
  filterSelectChevron: "spyne-filter-select__chevron",
  /** Popover / dropdown anchor — same chrome as filter select (e.g. Lot holding cost widget) */
  toolbarTrigger: "spyne-toolbar-trigger",
  /** Line tab row — hairline bottom, `margin-bottom` = sales stack gap (24px) */
  lineTabStrip: "spyne-line-tab-strip",
  lineTabStripBleed: "spyne-line-tab-strip--bleed",
  lineTabStripCompact: "spyne-line-tab-strip--compact",
  lineTabStripTight: "spyne-line-tab-strip--tight",
  lineTabStripEmbedded: "spyne-line-tab-strip--embedded",
  lineTab: "spyne-line-tab",
  lineTabActive: "spyne-line-tab--active",
  lineTabBadge: "spyne-line-tab__badge",
  /** Wrap label + `SpyneLineTabInlineCount` so the count is flush: `All(89)` (no flex gap). */
  lineTabLabelWithCount: "spyne-line-tab__label-with-count",
  /** Parenthetical count on line tabs (same ink as label; use instead of `SpyneLineTabBadge`). */
  lineTabCountInline: "spyne-line-tab__count-inline",
  /**
   * ROI / KPI metric strip (Lot View lot KPI row, Sales overview metrics).
   * White shell, 8px radius, theme border; grid with responsive row/column dividers.
   */
  roiKpiStrip: "rounded-xl border bg-card overflow-hidden",
  roiKpiStripGrid:
    "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x",
  /** Studio-style KPI cards: separate rounded shells with gap (no shared outer border). */
  roiKpiStripCards: "grid grid-cols-1 gap-4",
  /** Featured KPI card — large radius, Spyne border, room for background sparkline. */
  roiKpiMetricCard:
    "relative flex min-h-0 min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-spyne-border bg-card p-5 shadow-none sm:p-6",
  roiKpiMetricCardSparkline:
    "pointer-events-none absolute inset-x-0 bottom-0 h-[5.5rem] w-full",
  /** Icon well: 8px radius, explicit success-tint border, white fill (Studio KPI cards). */
  roiKpiMetricCardIconWrap:
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border border-[rgba(4,124,72,0.21)] bg-white text-spyne-success",
  /** One metric column — padding matches Lot reference (20px horizontal, 16px vertical). */
  roiKpiMetricCell: "px-5 py-4",
  roiKpiMetricLabelRow: "flex items-center mb-3",
  /** Colored dot for data legends only (e.g. disposition retail/wholesale). Do NOT use in metric label headers. */
  roiKpiMetricDot: "h-1.5 w-1.5 rounded-full shrink-0",
  roiKpiMetricLabel:
    "text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
  roiKpiMetricValue: "text-3xl font-bold tracking-tight mb-1.5 text-foreground",
  roiKpiMetricSub: "text-[11px] text-muted-foreground leading-snug",
  roiKpiDispositionBarTrack: "flex h-2 rounded-full overflow-hidden gap-px mb-3",
  roiKpiDispositionLegend: "space-y-1.5",
  roiKpiDispositionLegendRow: "flex items-center justify-between",
  roiKpiDispositionLegendLabel: "text-xs text-muted-foreground",
  roiKpiDispositionLegendPct:
    "text-[10px] text-muted-foreground tabular-nums w-[28px] text-right",
  /**
   * Dark tooltip (Radix): transparent `Content` wrapper + near-black panel. See `SpyneDarkTooltipPanel`, `.spyne-dark-tooltip-*` in `app/globals.css`.
   */
  darkTooltipRadixContent:
    "spyne-dark-tooltip-radix-content animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
  darkTooltipPanel: "spyne-dark-tooltip-panel",
  darkTooltipTitle: "spyne-dark-tooltip-title",
  darkTooltipList: "spyne-dark-tooltip-list",
  darkTooltipItem: "spyne-dark-tooltip-item",
  darkTooltipBullet: "spyne-dark-tooltip-bullet",
  darkTooltipInnerWell: "spyne-dark-tooltip-inner-well",
  darkTooltipSectionLabel: "spyne-dark-tooltip-section-label",
  darkTooltipMeta: "spyne-dark-tooltip-meta",
  darkTooltipArrow: "spyne-dark-tooltip-arrow",
  /** Row of action tab cards (grid columns set by consumer, e.g. lg:grid-cols-6) */
  actionTabStrip: "spyne-action-tab-strip",
  actionTab: "spyne-action-tab",
  actionTabSelected: "spyne-action-tab--selected",
  actionTabIcon: "spyne-action-tab__icon",
  actionTabTitle: "spyne-action-tab__title",
  actionTabCount: "spyne-action-tab__count",
  /** Inventory list header — underline tabs + quick chips */
  inventoryTab: "spyne-inventory-tab",
  inventoryTabActive: "spyne-inventory-tab--active",
  inventoryQuickChip: "spyne-inventory-quick-chip",
  inventoryQuickChipActive: "spyne-inventory-quick-chip--active",
  inventoryQuickChipCount: "spyne-inventory-quick-chip__count",
  /** Cycling placeholder line inside inventory search */
  inventorySearchHint: "spyne-inventory-search-hint",
  /**
   * Studio inventory data tables (Active Inventory, Lot inventory routes, merchandising summary vehicle lists).
   * Shared column titles, body typography (14px), row rules on `border-spyne-border`,
   * vertical column dividers on `border-spyne-border/45` (lighter than row borders).
   */
  studioInventoryTable: "w-full min-w-[500px] border-collapse text-sm text-spyne-text",
  /** Optional title row above the grid (matches panel section headers) */
  studioInventoryTableTitle: "text-sm font-semibold text-spyne-text",
  /** `<thead><tr>`: slightly darker strip + bottom rule (Active / Lot inventory tables) */
  studioInventoryTableHeaderRow: "border-b border-spyne-border bg-muted/80",
  /** Default `<th>` (left-aligned, vertically centered with checkbox column) */
  studioInventoryTableHeadCell:
    "border-r border-spyne-border/45 py-2 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-spyne-text whitespace-nowrap last:border-r-0",
  studioInventoryTableHeadCellRight: "text-right",
  studioInventoryTableHeadCellCenter: "text-center",
  /** Body `<tr>`: explicit row line + hover */
  studioInventoryTableRow:
    "border-b border-spyne-border bg-spyne-surface transition-colors duration-150 hover:bg-spyne-primary-soft/40",
  /** Default `<td>` */
  studioInventoryTableCell:
    "border-r border-spyne-border/45 py-3 px-4 align-top text-sm text-spyne-text last:border-r-0",
  /** Secondary line (dates, sub-labels) inside a cell */
  studioInventoryTableCellMeta: "text-xs text-spyne-text-secondary tabular-nums leading-snug",
  /**
   * VIN + stock # under the vehicle title (copy-to-clip). Inter only (not `font-sans` / Geist); secondary grey.
   * Use on `CopyOnClickIdentifier` in inventory tables.
   */
  studioInventoryVinStockIdentifier:
    "font-[family-name:Inter,ui-sans-serif,system-ui,sans-serif] text-spyne-text-secondary",
  /** Checkbox column header/cell — minimal gap before vehicle thumb (`VehicleMediaTable`) */
  studioInventoryTableCheckboxTh: "w-9 border-r border-spyne-border/45 py-2 pl-3 pr-1.5 last:border-r-0",
  studioInventoryTableCheckboxTd: "border-r border-spyne-border/45 py-2.5 pl-3 pr-1.5 align-top last:border-r-0",
  /** Narrow last column for row kebab menu (`VehicleMediaTable`) — use with `studioInventoryTableHeadCell` / `studioInventoryTableCell` */
  studioInventoryTableRowMenuTh: "w-10 !px-1 text-center",
  studioInventoryTableRowMenuTd: "w-10 !px-1",
  /** Vehicle column immediately after checkbox — left padding matches `VehicleMediaTable` tbody `py-2.5` so inset from column rule ≈ inset above thumb */
  studioInventoryTableVehicleColAfterCheckbox: "!pl-2.5",
  /** Thumb + title stack inside a vehicle cell */
  studioInventoryTableVehicleMediaRow: "flex items-start gap-4",
  /** Standalone thumb column + following vehicle column (merchandising summary lists, etc.) */
  studioInventoryTableThumbCol: "!pl-3 !pr-4",
  studioInventoryTableVehicleColAfterThumb: "!pl-3",
  /** Inventory filter drawer (checkbox accordions) */
  filterPanelRoot: "spyne-filter-panel-root",
  filterPanel: "spyne-filter-panel",
  filterPanelHeader: "spyne-filter-panel__header",
  filterPanelTitle: "spyne-filter-panel__title",
  filterPanelClose: "spyne-filter-panel__close",
  filterPanelBody: "spyne-filter-panel__body",
  filterPanelFooter: "spyne-filter-panel__footer",
  filterSection: "spyne-filter-section",
  filterSectionTrigger: "spyne-filter-section__trigger",
  filterOption: "spyne-filter-option",
  filterOptionCount: "spyne-filter-option__count",
  filterMore: "spyne-filter-more",
  /** Collapsed sidebar rail — `components/max-2/max2-sidebar-rail.tsx` + `.spyne-sidebar-rail*` in `app/globals.css` */
  sidebarRailDivider: "spyne-sidebar-rail__divider",
  sidebarRailLink: "spyne-sidebar-rail__link",
  sidebarRailLinkCollapsed: "spyne-sidebar-rail__link--collapsed",
  sidebarRailLinkExpanded: "spyne-sidebar-rail__link--expanded",
  sidebarRailLabelCollapsed: "spyne-sidebar-rail__label-collapsed",
  /** Nested nav under Studio / Lot (expanded rail only) */
  sidebarRailChildGroup: "spyne-sidebar-rail__child-group",
  sidebarRailChildLink: "spyne-sidebar-rail__child-link",
  sidebarRailChildLinkActive: "spyne-sidebar-rail__child-link--active",
} as const

/**
 * Leading icon on `SpyneLineTab` rows (module secondary nav, 14px labels).
 * Slightly larger than label size for optical balance; must be a supported `MaterialSymbol` size (14 | 16 | 20 | 24).
 */
export const spyneLineTabLeadingIconSize = 16 as const

/**
 * Main column padding: 24px on all sides.
 */
export const max2Layout = {
  /** 32px top, 24px horizontal + bottom — see `max2Tokens` / `design-system/max-2.md` */
  pagePadding: "px-max2-page pb-max2-page pt-max2-page-top",
  pageGutterX: "px-max2-page",
  /** Major blocks — 24px gaps; 16px from page header block (first child with `.max2-page-title`) to next block */
  pageStack: "spyne-max2-page-stack",
  /** Legacy: unused when the whole Max 2 tree is Spyne-scoped */
  contentTone: "max2-content",
} as const

/**
 * Prefixes for `isMax2SpyneScopedPath`. The Max 2 layout uses a single root prefix so **every**
 * tab (Home, Studio, Marketing, Sales, Service, Customers, Lot, …) gets `.max2-spyne` and tokenized UI.
 *
 * Tab and sub-tab UI must use Spyne primitives (`SpyneLineTabStrip`, `SpyneSegmentedControl`, `Max2ActionTabStrip`, …), not `@/components/ui/tabs`. See `design-system/max-2.md`.
 */
export const max2SpyneRoutePrefixes = ["/max-2"] as const

export function isMax2SpyneScopedPath(pathname: string): boolean {
  return max2SpyneRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

// (chip-preset re-exports removed — not used by the Action Items surface; kept this module
//  self-contained so the standalone app has no dangling dependency.)
