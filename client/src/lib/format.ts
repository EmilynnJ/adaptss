export const fmtUSD = (cents: number) => `$${(cents / 100).toFixed(2)}`;
export const fmtDate = (d?: string | Date | null) => (d ? new Date(d).toLocaleDateString() : "-");
export const fmtClock = (sec: number) => {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};
export const stars = (n: number) => "★".repeat(Math.round(n)) + "☆".repeat(5 - Math.round(n));
