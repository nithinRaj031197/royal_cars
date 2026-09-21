import Link from "next/link";
import { requireSession } from "@/server/auth";
import { getStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { allMoneyTrails } from "@/server/services/ledger";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { formatINR } from "@/lib/money";
import { Stagger, StaggerItem } from "@/components/motion";

export const dynamic = "force-dynamic";

/**
 * The money trail for every car the showroom owns: what it cost to buy, what was
 * spent preparing it, what it sold for and what is still owed in each direction.
 */
export default async function LedgerPage() {
  const session = await requireSession();
  const user = session.user;

  if (!can(user, "purchase.view")) {
    return (
      <div>
        <PageHeader title="Car money trail" />
        <EmptyState
          title="Not available for your role"
          hint="The money trail shows purchase cost and margin. Ask an owner if you need access."
        />
      </div>
    );
  }

  const showProfit = can(user, "profit.view");
  const trails = await allMoneyTrails(getStore());

  const totals = trails.reduce(
    (acc, t) => ({
      invested: acc.invested + t.investmentPaise,
      owedToSellers: acc.owedToSellers + Math.max(0, t.purchase.outstandingPaise),
      owedByCustomers: acc.owedByCustomers + (t.sale?.outstandingPaise ?? 0),
      profit: acc.profit + t.result.contributionPaise
    }),
    { invested: 0, owedToSellers: 0, owedByCustomers: 0, profit: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Car money trail"
        subtitle="Every rupee per car — seller → showroom → customer"
      />

      <Stagger label="Totals" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StaggerItem className="h-full">
          <div className="card flex h-full flex-col p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total invested</p>
            <p className="mt-1.5 text-2xl font-semibold tabular text-slate-900">{formatINR(totals.invested)}</p>
            <p className="mt-1 text-xs text-slate-500">Across {trails.length} car(s)</p>
          </div>
        </StaggerItem>
        <StaggerItem className="h-full">
          <div className="card flex h-full flex-col p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Still owed to sellers</p>
            <p className="mt-1.5 text-2xl font-semibold tabular text-red-700">{formatINR(totals.owedToSellers)}</p>
          </div>
        </StaggerItem>
        <StaggerItem className="h-full">
          <div className="card flex h-full flex-col p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Still owed by customers</p>
            <p className="mt-1.5 text-2xl font-semibold tabular text-red-700">{formatINR(totals.owedByCustomers)}</p>
          </div>
        </StaggerItem>
        {showProfit ? (
          <StaggerItem className="h-full">
            <div className="card flex h-full flex-col p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Contribution (sold cars)</p>
              <p className={`mt-1.5 text-2xl font-semibold tabular ${totals.profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {formatINR(totals.profit)}
              </p>
              <p className="mt-1 text-xs text-slate-500">After showroom-funded service</p>
            </div>
          </StaggerItem>
        ) : null}
      </Stagger>

      {trails.length === 0 ? (
        <EmptyState title="No cars owned yet" hint="Acquire a vehicle to start its money trail." />
      ) : (
        <div className="card overflow-hidden">
          <div className="table-scroll">
            <table className="table-base table-sticky-first">
              <thead>
                <tr>
                  <th>Car</th>
                  <th className="text-right">Bought for</th>
                  <th className="text-right">Owed to seller</th>
                  <th className="text-right">Spent on it</th>
                  <th className="text-right">Total invested</th>
                  <th className="text-right">Sold for</th>
                  <th className="text-right">Owed by customer</th>
                  {showProfit ? <th className="text-right">Contribution</th> : null}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trails.map((t) => (
                  <tr key={t.vehicle.id} className="transition-colors hover:bg-slate-50/80">
                    <td>
                      <p className="ref font-medium text-slate-900">{t.vehicle.stockRef}</p>
                      <p className="text-xs text-slate-500">{t.vehicle.title}</p>
                      <div className="mt-1"><StatusBadge status={t.vehicle.state} /></div>
                    </td>
                    <td className="tabular text-right">{formatINR(t.purchase.agreedPaise)}</td>
                    <td className={`text-right ${t.purchase.outstandingPaise > 0 ? "text-red-700" : "text-slate-400"}`}>
                      {formatINR(t.purchase.outstandingPaise)}
                    </td>
                    <td className="tabular text-right">{formatINR(t.preparation.totalPaise)}</td>
                    <td className="tabular text-right font-semibold text-slate-900">{formatINR(t.investmentPaise)}</td>
                    <td className="tabular text-right">{t.sale ? formatINR(t.sale.pricePaise) : <span className="text-slate-400">—</span>}</td>
                    <td className={`text-right ${(t.sale?.outstandingPaise ?? 0) > 0 ? "text-red-700" : "text-slate-400"}`}>
                      {t.sale ? formatINR(t.sale.outstandingPaise) : "—"}
                    </td>
                    {showProfit ? (
                      <td className={`text-right font-semibold ${!t.result.sold ? "text-slate-400" : t.result.contributionPaise >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                        {t.result.sold ? formatINR(t.result.contributionPaise) : "—"}
                      </td>
                    ) : null}
                    <td className="text-right">
                      <Link className="whitespace-nowrap text-sm font-medium text-brand-700 hover:text-brand-800" href={`/ledger/${t.vehicle.id}`}>
                        Full trail →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Total invested = agreed purchase price + completed showroom-funded repairs + accessories not already billed in a
        work order + other showroom costs. Contribution = sale price − total invested − showroom-funded after-sale work.
        It is a per-car figure and excludes general overhead, so it is not the business&rsquo;s net profit.
      </p>
    </div>
  );
}
