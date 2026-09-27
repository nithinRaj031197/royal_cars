import { requireSession } from "@/server/auth";
import { getRepo } from "@/lib/repo";
import { can } from "@/lib/permissions";
import { PageHeader, StatusBadge } from "@/components/ui";
import { getSettings } from "@/server/services/settings";
import { SettingsForm, StaffForm, StaffStatusButton, ImportForm, ReconcileButton } from "./settings-forms";

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
            {(() => {
              const pending = staff.filter((s) => s.active === "FALSE");
              return pending.length && can(user, "staff.manage") ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {pending.length} account{pending.length === 1 ? "" : "s"} waiting for approval — see below.
                </div>
              ) : null;
            })()}
            <h2 className="mb-2 font-semibold">Staff ({staff.length})</h2>
            <div className="table-scroll -mx-4 px-4">
            <table className="table-base table-sticky-first">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th>{can(user, "staff.manage") ? <th /> : null}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {staff.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td className="text-xs">{s.email}</td>
                    <td>{s.role}</td>
                    <td><StatusBadge status={s.active === "FALSE" ? "Pending" : "Active"} /></td>
                    {can(user, "staff.manage") ? (
                      <td>
                        {(s.email ?? "").toLowerCase() === user.email.toLowerCase() ? (
                          <span className="text-xs text-slate-400">(you)</span>
                        ) : (
                          <StaffStatusButton
                            email={s.email ?? ""}
                            name={s.name ?? ""}
                            role={s.role ?? "sales"}
                            phone={s.phone ?? ""}
                            active={s.active !== "FALSE"}
                          />
                        )}
                      </td>
                    ) : null}
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
