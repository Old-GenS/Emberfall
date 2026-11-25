/** Plain-text tables for the terminal. No dependencies. */

export type Cell = string | number;

const width = (s: string): number => s.length;

/** Left-align the first column, right-align the rest; `head` is printed in uppercase with a rule. */
export function table(head: string[], rows: Cell[][]): string {
  const cols = head.map((h, i) => Math.max(width(h), ...rows.map((r) => width(String(r[i] ?? '')))));
  const line = (cells: Cell[]) => cells
    .map((c, i) => {
      const s = String(c ?? '');
      return i === 0 ? s.padEnd(cols[i]) : s.padStart(cols[i]);
    })
    .join('  ').trimEnd();
  const out = [line(head), head.map((_, i) => '-'.repeat(cols[i])).join('  '), ...rows.map(line)];
  return out.join('\n');
}

export const f1 = (n: number): string => (Number.isFinite(n) ? n.toFixed(1) : '-');
export const f0 = (n: number): string => (Number.isFinite(n) ? n.toFixed(0) : '-');
export const pc = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(0)}%` : '-');
export const pc1 = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(1)}%` : '-');
export const sec = (n: number): string => (Number.isFinite(n) ? `${n.toFixed(1)}s` : '-');
