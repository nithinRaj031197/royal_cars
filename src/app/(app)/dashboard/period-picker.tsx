"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PeriodPicker({ from, to }: { from: string; to: string }) {
  const router = useRouter();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);

  return (
    // Wraps on a phone: two date inputs plus a button do not fit on one 390px
    // row, and letting them overflow makes the whole page scroll sideways.
    <form
      className="grid w-full grid-cols-2 items-end gap-2 sm:flex sm:w-auto"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/dashboard?from=${f}&to=${t}`);
      }}
    >
      <div className="min-w-0">
        <label className="label" htmlFor="from">From</label>
        <input id="from" type="date" className="input" value={f} onChange={(e) => setF(e.target.value)} />
      </div>
      <div className="min-w-0">
        <label className="label" htmlFor="to">To</label>
        <input id="to" type="date" className="input" value={t} onChange={(e) => setT(e.target.value)} />
      </div>
      <button className="btn-primary col-span-2 sm:col-span-1">Apply</button>
    </form>
  );
}
