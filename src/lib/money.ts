/** UGX is zero-decimal: show whole shillings, never cents. */
export function formatMoney(value: number | string | null | undefined) {
  return `UGX ${Math.round(Number(value ?? 0)).toLocaleString("en-UG")}`;
}

/** Bare number for tight stat tiles where the currency is already in the label. */
export function formatAmount(value: number | string | null | undefined) {
  return Math.round(Number(value ?? 0)).toLocaleString("en-UG");
}

/** Signed, for ledger rows: "+UGX 2,000" / "−UGX 20,000". */
export function formatSigned(value: number | string | null | undefined) {
  const n = Math.round(Number(value ?? 0));
  if (n < 0) return `−${formatMoney(Math.abs(n))}`;
  return `+${formatMoney(n)}`;
}
