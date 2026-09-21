import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { formatINR } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { AddVendorForm } from "./vendor-form";

export const dynamic = "force-dynamic";

export default async function VendorsPage() {
  const session = await requireSession();
  const repo = getRepo();
  const [vendors, expenses] = await Promise.all([repo.table("Vendors").list(), repo.table("Expenses").list()]);

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    if (e.payer !== "Showroom") continue;
    const cat = e.category ?? "Miscellaneous";
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + Number(e.amountPaise ?? 0));
  }
  const canManage = can(session.user, "vendor.manage");

  return (
    <div>
      <PageHeader title="Vendors & Expenses" subtitle="Workshops, suppliers and showroom expense summary" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <h2 className="mb-2 font-semibold">Vendors ({vendors.length})</h2>
          <div className="card overflow-hidden"><div className="table-scroll">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Name</th><th>Category</th><th>Phone</th><th>Preferred</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {vendors.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name}</td>
                    <td>{v.category}</td>
                    <td>{v.phone || "—"}</td>
                    <td>{v.preferred === "TRUE" ? "★" : ""}</td>
                  </tr>
                ))}
                {vendors.length === 0 ? <tr><td colSpan={4} className="text-slate-500">No vendors yet.</td></tr> : null}
              </tbody>
            </table>
          </div></div>

          <h2 className="mb-2 mt-6 font-semibold">Showroom expenses by category</h2>
          <div className="card overflow-hidden"><div className="table-scroll">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Category</th><th>Total</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {[...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                  <tr key={cat}><td>{cat}</td><td>{formatINR(total)}</td></tr>
                ))}
                {byCategory.size === 0 ? <tr><td colSpan={2} className="text-slate-500">No expenses recorded.</td></tr> : null}
              </tbody>
            </table>
          </div></div>
        </div>

        <div>
          {canManage ? <AddVendorForm /> : null}
          <div className="card mt-4 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-800">Notes</p>
            <p className="mt-1">Purchase payments to sellers are NOT expenses — they settle the purchase liability.</p>
            <p className="mt-1">Only posted actual costs (completed work orders, standalone accessories, other expenses) affect investment.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
