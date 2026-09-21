export type Role = "owner" | "sales" | "operations" | "accounts";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type Permission =
  | "acquisition.view"
  | "acquisition.manage"
  | "purchase.view" // purchase price + seller balance (confidential)
  | "purchase.manage"
  | "inspection.view"
  | "inspection.manage"
  | "inventory.view"
  | "inventory.manage"
  | "work.view"
  | "work.manage"
  | "expense.view"
  | "expense.manage"
  | "vendor.view"
  | "vendor.manage"
  | "crm.view"
  | "crm.manage"
  | "sales.view"
  | "sales.manage"
  | "payment.view"
  | "payment.manage"
  | "delivery.view"
  | "delivery.manage"
  | "aftersale.view"
  | "aftersale.manage"
  | "profit.view" // confidential: margins, minimum price
  | "report.financial" // financial reports & CSV exports of financials
  | "document.sensitive" // identity documents and other sensitive scans
  | "settings.manage"
  | "staff.manage"
  | "import.run";

const ALL: Permission[] = [
  "acquisition.view", "acquisition.manage", "purchase.view", "purchase.manage",
  "inspection.view", "inspection.manage", "inventory.view", "inventory.manage",
  "work.view", "work.manage", "expense.view", "expense.manage",
  "vendor.view", "vendor.manage", "crm.view", "crm.manage",
  "sales.view", "sales.manage", "payment.view", "payment.manage",
  "delivery.view", "delivery.manage", "aftersale.view", "aftersale.manage",
  "profit.view", "report.financial", "document.sensitive", "settings.manage", "staff.manage", "import.run"
];

const OWNER: Permission[] = ALL;

const SALES: Permission[] = [
  "acquisition.view", "inspection.view", "inventory.view",
  "crm.view", "crm.manage", "sales.view", "sales.manage",
  "delivery.view", "aftersale.view", "vendor.view", "document.sensitive", "import.run"
];

const OPERATIONS: Permission[] = [
  "acquisition.view", "acquisition.manage", "purchase.view",
  "inspection.view", "inspection.manage", "inventory.view", "inventory.manage",
  "work.view", "work.manage", "expense.view", "expense.manage",
  "vendor.view", "vendor.manage", "crm.view",
  "sales.view", "delivery.view", "delivery.manage", "aftersale.view", "aftersale.manage",
  "import.run"
];

const ACCOUNTS: Permission[] = [
  "acquisition.view", "purchase.view", "purchase.manage",
  "inventory.view", "work.view", "expense.view", "expense.manage",
  "vendor.view", "vendor.manage",
  "sales.view", "payment.view", "payment.manage",
  "delivery.view", "aftersale.view",
  "profit.view", "report.financial", "document.sensitive", "import.run"
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: OWNER,
  sales: SALES,
  operations: OPERATIONS,
  accounts: ACCOUNTS
};

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner / Admin",
  sales: "Sales",
  operations: "Operations",
  accounts: "Accounts"
};

export function can(user: { role?: Role } | null | undefined, perm: Permission): boolean {
  if (!user?.role) return false; // a session without a resolved role is denied
  return ROLE_PERMISSIONS[user.role]?.includes(perm) ?? false;
}

export function assertCan(user: { role?: Role } | null | undefined, perm: Permission): void {
  if (!can(user, perm)) {
    throw Object.assign(new Error("You do not have permission to perform this action."), { status: 403 });
  }
}

export function isRole(v: string): v is Role {
  return v === "owner" || v === "sales" || v === "operations" || v === "accounts";
}

/** Fields hidden from roles without profit.view (enforced in projections). */
export const CONFIDENTIAL_FIELDS = [
  "purchasePricePaise",
  "minimumPricePaise",
  "snapshotInvestmentPaise",
  "snapshotGrossProfitPaise",
  "estimatedRepairPaise",
  "actualPaise",
  "totalPaise"
] as const;
