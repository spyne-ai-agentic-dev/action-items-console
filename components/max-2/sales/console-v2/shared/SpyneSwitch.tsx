"use client";

/**
 * SpyneSwitch — accessible role=switch toggle with the system focus ring.
 * Replaces the hand-rolled toggles in data-health and the customer-profile
 * AI↔human takeover. Track turns brand when on; thumb slides on ease-out.
 */

export function SpyneSwitch({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`spyne-focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      style={{ background: checked ? "var(--spyne-primary)" : "var(--spyne-border)" }}
    >
      <span
        className="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(18px)" : "translateX(2px)" }}
      />
    </button>
  );
}
