"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import { MotionProvider, NavDrawer } from "./motion";
import {
  IconAcquisitions, IconCar, IconChart, IconClose, IconDashboard, IconFileText,
  IconInspections, IconLifebuoy, IconLogout, IconMenu, IconReceipt, IconSettings,
  IconStore, IconUsers, IconLedger
} from "./icons";

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner / Admin",
  sales: "Sales",
  operations: "Operations",
  accounts: "Accounts"
};

/**
 * Navigation follows the car's journey and the money that moves with it —
 * seller → showroom → customer → after-sale — because that is how the showroom
 * actually thinks about a vehicle. Grouping by software module ("CRM",
 * "Inventory") forces staff to translate their own process into our structure.
 */
const GROUPS: Array<{
  label?: string;
  links: Array<{ href: string; label: string; Icon: (p: { className?: string }) => React.ReactElement }>;
}> = [
  { links: [{ href: "/dashboard", label: "Dashboard", Icon: IconDashboard }] },
  {
    label: "Buying",
    links: [
      { href: "/acquisitions", label: "Seller enquiries", Icon: IconAcquisitions },
      { href: "/inventory", label: "Cars we own", Icon: IconCar }
    ]
  },
  {
    label: "Preparing",
    links: [
      { href: "/inspections", label: "Inspections & work", Icon: IconInspections },
      { href: "/vendors", label: "Vendors & expenses", Icon: IconStore }
    ]
  },
  {
    label: "Selling",
    links: [
      { href: "/leads", label: "Leads & customers", Icon: IconUsers },
      { href: "/sales", label: "Sales & delivery", Icon: IconReceipt },
      { href: "/customer", label: "Customer copies", Icon: IconFileText }
    ]
  },
  {
    label: "After sale",
    links: [{ href: "/aftersale", label: "Service & support", Icon: IconLifebuoy }]
  },
  {
    label: "Money",
    links: [
      { href: "/ledger", label: "Car money trail", Icon: IconLedger },
      { href: "/reports", label: "Reports", Icon: IconChart },
      { href: "/settings", label: "Settings", Icon: IconSettings }
    ]
  }
];

function initials(name?: string | null, email?: string | null): string {
  const source = (name ?? email ?? "?").trim();
  const parts = source.split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Nav({ user }: { user: { name?: string | null; email?: string | null; role?: string } }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const panel = (
    <div className="flex h-full flex-col bg-ink-900">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-sm font-bold tracking-tight text-white shadow-lg shadow-brand-600/30">
            RC
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight text-white">Royal Cars</span>
        </Link>
        <button
          className="-mr-1 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        >
          <IconClose />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group, gi) => (
          <div key={group.label ?? gi} className={gi > 0 ? "mt-6" : ""} role="group" aria-label={group.label}>
            {group.label ? (
              <div className="flex items-center gap-2.5 px-3 pb-2 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {group.label}
                </span>
                {/* The rule runs to the edge, which a tappable row never does. */}
                <span className="h-px flex-1 bg-white/10" aria-hidden />
              </div>
            ) : null}
            <ul className="space-y-0.5">
              {group.links.map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-brand-600/15 font-medium text-white"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {active ? (
                        <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-brand-500" aria-hidden />
                      ) : null}
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-brand-500" : "text-slate-500 group-hover:text-slate-300"}`} />
                      <span className="truncate">{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials(user.name, user.email)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name ?? user.email}</p>
            <p className="truncate text-xs text-slate-400">{ROLE_LABELS[user.role ?? ""] ?? user.role}</p>
          </div>
        </div>
        <button
          className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <IconLogout className="h-[18px] w-[18px] text-slate-500" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <MotionProvider>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-white/10 bg-ink-900 px-4 lg:hidden">
        <button
          className="-ml-1.5 rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <IconMenu />
        </button>
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600 text-[10px] font-bold text-white">RC</span>
          <span className="font-display text-[15px] font-semibold tracking-tight text-white">Royal Cars</span>
        </Link>
        <span className="ml-auto grid h-8 w-8 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white">
          {initials(user.name, user.email)}
        </span>
      </header>

      <NavDrawer open={open} onClose={() => setOpen(false)}>
        {panel}
      </NavDrawer>
    </MotionProvider>
  );
}
