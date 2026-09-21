import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/ui";
import { getSettings } from "@/server/services/settings";
import { SettingsForm, StaffForm, ImportForm, ReconcileButton } from "./settings-forms";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requireSession();
  const user = session.user;
  const repo = getRepo();
  const settings = await getSettings();
  const staff = await repo.table("Staff").list({ activeOnly: false });
  const batches = await repo.table("ImportBatches").list({ activeOnly: false });
  const canManage = can(user, "settings.manage");

  return (
    <div>
      <PageHeader title="Settings" subtitle="Showroom identity, staff, imports and data health" />

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsForm initial={settings} disabled={!canManage} />

        <div className="min-w-0 space-y-4">
          <div className="card p-4">
            <h2 className="mb-2 font-semibold">Staff ({staff.length})</h2>
            <div className="table-scroll -mx-4 px-4">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="text-xs">{s.email}</td>
                    <td>{s.role}</td>
                    <td>{s.active === "FALSE" ? "No" : "Yes"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {can(user, "staff.manage") ? <StaffForm /> : <p className="mt-2 text-xs text-slate-500">Only owners can manage staff.</p>}
          </div>

          {can(user, "import.run") ? (
            <div className="card p-4">
              <h2 className="mb-2 font-semibold">CSV import</h2>
              <p className="mb-2 text-xs text-slate-500">
                Templates:{" "}
                <a className="text-brand-700" href="/api/import/template?entity=Vehicles">Vehicles</a> ·{" "}
                <a className="text-brand-700" href="/api/import/template?entity=Customers">Customers</a> ·{" "}
                <a className="text-brand-700" href="/api/import/template?entity=Vendors">Vendors</a> ·{" "}
                <a className="text-brand-700" href="/api/import/template?entity=Expenses">Expenses</a>
              </p>
              <ImportForm />
              <h3 className="mt-3 text-sm font-medium">Import history</h3>
              <ul className="text-xs text-slate-600">
                {batches.map((b) => (
                  <li key={b.id}>
                    {b.batchRef} · {b.entityType} · {b.mode} · created {b.createdCount}, errors {b.errorCount}
                  </li>
                ))}
                {batches.length === 0 ? <li>No imports yet.</li> : null}
              </ul>
            </div>
          ) : null}

          {can(user, "settings.manage") ? <ReconcileButton /> : null}
        </div>
      </div>
    </div>
  );
}
