"use client";

export function PrintLink() {
  return (
    <button className="btn-secondary no-print" onClick={() => window.print()}>
      Print
    </button>
  );
}
