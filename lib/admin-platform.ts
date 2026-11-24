import "server-only";
import { getSql } from "@/lib/db";
import { decimalToMinor, minorToDecimal } from "@/lib/money";

/**
 * Administrative platform services.
 *
 * Read queries are scoped here; every state change is implemented in
 * lib/admin-ops.ts, lib/wallet.ts, lib/marketplace.ts or lib/customer-services.ts
 * with a same-statement audit event. This module never alters a balance.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

/**
 * Resolves the permission set for a staff account. The bootstrap admin (no
 * explicit role row) keeps full access so a fresh deployment is never locked
 * out; a compliance account starts with its compliance permissions only.
 */
export async function staffPermissions(userId: string, role: string): Promise<Set<string>> {
  const sql = getSql();
  const found = rows<{ permissions: unknown }>(await sql`
    SELECT r.permissions FROM app_users u LEFT JOIN admin_roles r ON r.id = u.admin_role_id
    WHERE u.id = ${userId} LIMIT 1
  `);
  const raw = found[0]?.permissions;
  if (raw === null || raw === undefined) {
    return role === "admin"
      ? new Set([
          "customers.read", "customers.write", "investments.read", "investments.write", "products.write",
          "wallet.read", "wallet.write", "kyc.read", "kyc.write", "support.read", "support.write",
          "reports.read", "staff.write", "settings.write",
        ])
      : new Set(["customers.read", "kyc.read", "kyc.write", "reports.read", "investments.read"]);
  }
  let list: string[] = [];
  if (Array.isArray(raw)) list = raw.map(String);
  else if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.map(String);
    } catch {
      list = [];
    }
  }
  return new Set(list);
}

export async function staffCan(user: { id: string; role: string }, permission: string) {
  if (user.role !== "admin" && user.role !== "compliance") return false;
  const permissions = await staffPermissions(user.id, user.role);
  return permissions.has(permission);
}

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as T[]) : [];
}

export type PlatformOverview = {
  customers: number;
  activeCustomers: number;
  activeAccounts: number;
  verifiedDeposits: string;
  totalWithdrawals: string;
  pendingWithdrawals: string;
  pendingWithdrawalCount: number;
  activeInvestments: number;
  investedPrincipal: string;
  assetsUnderCustody: string;
  platformRevenue: string;
  pendingKyc: number;
  pendingOrders: number;
  openTickets: number;
  currency: string;
};

export async function getPlatformOverview(): Promise<PlatformOverview> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT
      (SELECT count(*)::int FROM app_users WHERE role = 'customer') AS customers,
      (SELECT count(*)::int FROM app_users WHERE role = 'customer' AND status = 'active') AS active_customers,
      (SELECT count(*)::int FROM customer_accounts WHERE status = 'active') AS active_accounts,
      (SELECT COALESCE(sum(amount), 0)::text FROM wallet_requests
        WHERE kind = 'deposit' AND status = 'posted') AS verified_deposits,
      (SELECT COALESCE(sum(amount), 0)::text FROM wallet_requests
        WHERE kind = 'withdrawal' AND status = 'posted') AS total_withdrawals,
      (SELECT COALESCE(sum(amount), 0)::text FROM wallet_requests
        WHERE kind = 'withdrawal' AND status = 'pending') AS pending_withdrawals,
      (SELECT count(*)::int FROM wallet_requests WHERE kind = 'withdrawal' AND status = 'pending') AS pending_withdrawal_count,
      (SELECT count(*)::int FROM investments WHERE status = 'active') AS active_investments,
      (SELECT COALESCE(sum(principal), 0)::text FROM investments WHERE status = 'active') AS invested_principal,
      (SELECT COALESCE(sum(e.amount), 0)::text FROM ledger_entries e
        WHERE e.wallet_id IS NOT NULL OR e.account_id IS NOT NULL) AS custody,
      (SELECT COALESCE(sum(e.amount), 0)::text FROM ledger_entries e
        JOIN ledger_accounts la ON la.id = e.ledger_account_id
        WHERE la.kind = 'revenue') AS revenue,
      (SELECT count(*)::int FROM kyc_submissions WHERE status = 'pending') AS pending_kyc,
      (SELECT count(*)::int FROM investment_orders WHERE status = 'pending') AS pending_orders,
      (SELECT count(*)::int FROM support_tickets WHERE status IN ('open','in_progress')) AS open_tickets
  `);
  const row = found[0] ?? {};
  const custody = decimalToMinor(String(row.custody ?? "0")) ?? 0;
  return {
    customers: Number(row.customers ?? 0),
    activeCustomers: Number(row.active_customers ?? 0),
    activeAccounts: Number(row.active_accounts ?? 0),
    verifiedDeposits: String(row.verified_deposits ?? "0"),
    totalWithdrawals: String(row.total_withdrawals ?? "0"),
    pendingWithdrawals: String(row.pending_withdrawals ?? "0"),
    pendingWithdrawalCount: Number(row.pending_withdrawal_count ?? 0),
    activeInvestments: Number(row.active_investments ?? 0),
    investedPrincipal: String(row.invested_principal ?? "0"),
    assetsUnderCustody: minorToDecimal(custody),
    platformRevenue: minorToDecimal(decimalToMinor(String(row.revenue ?? "0")) ?? 0),
    pendingKyc: Number(row.pending_kyc ?? 0),
    pendingOrders: Number(row.pending_orders ?? 0),
    openTickets: Number(row.open_tickets ?? 0),
    currency: "USD",
  };
}

export type CustomerDetail = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
  twoFactorEnabled: boolean;
  accounts: { id: string; number: string | null; type: string; currency: string; status: string; balance: string }[];
  wallet: { number: string; currency: string; balance: string; status: string } | null;
  investments: { id: string; product: string; principal: string; currency: string; status: string; createdAt: string }[];
  orders: { id: string; reference: string; symbol: string; side: string; quantity: string; notional: string; status: string }[];
  kycStatus: string | null;
  tickets: number;
  recentLedger: { id: string; amount: string; currency: string; description: string; createdAt: string }[];
};

export async function getCustomerDetail(userId: string): Promise<CustomerDetail | null> {
  if (!UUID.test(userId)) return null;
  const sql = getSql();
  const profile = rows<Record<string, unknown>>(await sql`
    SELECT id, full_name, email, role, status, created_at, last_login_at, two_factor_enabled
    FROM app_users WHERE id = ${userId} LIMIT 1
  `);
  const user = profile[0];
  if (!user) return null;

  const [accounts, wallet, investments, orders, kyc, tickets, ledger] = await Promise.all([
    sql`SELECT id, account_number, account_type, trim(currency) AS currency, status,
               COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.account_id = a.id), 0)::text AS balance
        FROM customer_accounts a WHERE user_id = ${userId} ORDER BY created_at DESC`,
    sql`SELECT wallet_number, trim(currency) AS currency, status,
               COALESCE((SELECT sum(e.amount) FROM ledger_entries e WHERE e.wallet_id = w.id), 0)::text AS balance
        FROM wallets w WHERE user_id = ${userId} ORDER BY created_at ASC LIMIT 1`,
    sql`SELECT i.id, p.name AS product, i.principal::text AS principal, trim(i.currency) AS currency,
               i.status, i.created_at
        FROM investments i JOIN investment_products p ON p.id = i.product_id
        WHERE i.user_id = ${userId} ORDER BY i.created_at DESC LIMIT 20`,
    sql`SELECT o.id, o.reference, m.symbol, o.side, o.quantity::text AS quantity,
               o.notional::text AS notional, o.status
        FROM investment_orders o JOIN market_instruments m ON m.id = o.instrument_id
        WHERE o.user_id = ${userId} ORDER BY o.created_at DESC LIMIT 20`,
    sql`SELECT status FROM kyc_submissions WHERE user_id = ${userId} LIMIT 1`,
    sql`SELECT count(*)::int AS total FROM support_tickets WHERE user_id = ${userId}`,
    sql`SELECT e.id, e.amount::text AS amount, trim(e.currency) AS currency, t.description, e.created_at
        FROM ledger_entries e JOIN ledger_transactions t ON t.id = e.transaction_id
        LEFT JOIN customer_accounts a ON a.id = e.account_id
        LEFT JOIN wallets w ON w.id = e.wallet_id
        WHERE a.user_id = ${userId} OR w.user_id = ${userId}
        ORDER BY e.created_at DESC LIMIT 15`,
  ]);

  const walletRow = rows<Record<string, unknown>>(wallet)[0];
  return {
    id: String(user.id),
    fullName: String(user.full_name),
    email: String(user.email),
    role: String(user.role),
    status: String(user.status),
    createdAt: String(user.created_at),
    lastLoginAt: user.last_login_at ? String(user.last_login_at) : null,
    twoFactorEnabled: Boolean(user.two_factor_enabled),
    accounts: rows<Record<string, unknown>>(accounts).map((row) => ({
      id: String(row.id),
      number: row.account_number ? String(row.account_number) : null,
      type: String(row.account_type),
      currency: String(row.currency).trim(),
      status: String(row.status),
      balance: String(row.balance),
    })),
    wallet: walletRow
      ? {
          number: String(walletRow.wallet_number),
          currency: String(walletRow.currency).trim(),
          balance: String(walletRow.balance),
          status: String(walletRow.status),
        }
      : null,
    investments: rows<Record<string, unknown>>(investments).map((row) => ({
      id: String(row.id),
      product: String(row.product),
      principal: String(row.principal),
      currency: String(row.currency).trim(),
      status: String(row.status),
      createdAt: String(row.created_at),
    })),
    orders: rows<Record<string, unknown>>(orders).map((row) => ({
      id: String(row.id),
      reference: String(row.reference),
      symbol: String(row.symbol),
      side: String(row.side),
      quantity: String(row.quantity),
      notional: String(row.notional),
      status: String(row.status),
    })),
    kycStatus: rows<{ status: string }>(kyc)[0]?.status ?? null,
    tickets: Number(rows<{ total: number }>(tickets)[0]?.total ?? 0),
    recentLedger: rows<Record<string, unknown>>(ledger).map((row) => ({
      id: String(row.id),
      amount: String(row.amount),
      currency: String(row.currency).trim(),
      description: String(row.description),
      createdAt: String(row.created_at),
    })),
  };
}

export type AdminTransaction = {
  id: string;
  amount: string;
  currency: string;
  description: string;
  reference: string | null;
  status: string;
  createdAt: string;
  owner: string;
  ownerEmail: string | null;
};

export async function listPlatformTransactions(limit = 200): Promise<AdminTransaction[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT e.id, e.amount::text AS amount, trim(e.currency) AS currency, t.description, t.reference, t.status,
           e.created_at,
           COALESCE(w.wallet_number, a.account_number, la.name) AS owner,
           u.email AS owner_email
    FROM ledger_entries e
    JOIN ledger_transactions t ON t.id = e.transaction_id
    LEFT JOIN wallets w ON w.id = e.wallet_id
    LEFT JOIN customer_accounts a ON a.id = e.account_id
    LEFT JOIN ledger_accounts la ON la.id = e.ledger_account_id
    LEFT JOIN app_users u ON u.id = COALESCE(w.user_id, a.user_id)
    ORDER BY e.created_at DESC LIMIT ${limit}
  `);
  return found.map((row) => ({
    id: String(row.id),
    amount: String(row.amount),
    currency: String(row.currency).trim(),
    description: String(row.description),
    reference: row.reference ? String(row.reference) : null,
    status: String(row.status),
    createdAt: String(row.created_at),
    owner: String(row.owner ?? "System"),
    ownerEmail: row.owner_email ? String(row.owner_email) : null,
  }));
}

export type PortfolioOverviewRow = {
  id: string;
  name: string;
  email: string;
  status: string;
  wallet: string;
  cash: string;
  holdings: string;
  plans: string;
  plansCount: number;
  total: string;
  currency: string;
};

export async function listCustomerPortfolios(): Promise<PortfolioOverviewRow[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT u.id, u.full_name, u.email, u.status,
      COALESCE((SELECT sum(e.amount) FROM ledger_entries e JOIN wallets w ON w.id = e.wallet_id
                WHERE w.user_id = u.id), 0)::text AS wallet,
      COALESCE((SELECT sum(e.amount) FROM ledger_entries e JOIN customer_accounts a ON a.id = e.account_id
                WHERE a.user_id = u.id), 0)::text AS cash,
      COALESCE((SELECT sum(h.quantity * p.price) FROM investment_holdings h
                JOIN LATERAL (SELECT price FROM market_prices WHERE instrument_id = h.instrument_id
                              ORDER BY as_of DESC LIMIT 1) p ON true
                WHERE h.user_id = u.id), 0)::text AS holdings,
      COALESCE((SELECT sum(principal) FROM investments i WHERE i.user_id = u.id AND i.status = 'active'), 0)::text AS plans,
      (SELECT count(*)::int FROM investments i WHERE i.user_id = u.id AND i.status = 'active') AS plans_count
    FROM app_users u
    WHERE u.role = 'customer'
    ORDER BY u.created_at DESC
    LIMIT 200
  `);
  return found.map((row) => {
    const wallet = decimalToMinor(String(row.wallet)) ?? 0;
    const cash = decimalToMinor(String(row.cash)) ?? 0;
    const holdings = decimalToMinor(String(row.holdings)) ?? 0;
    const plans = decimalToMinor(String(row.plans)) ?? 0;
    return {
      id: String(row.id),
      name: String(row.full_name),
      email: String(row.email),
      status: String(row.status),
      wallet: minorToDecimal(wallet),
      cash: minorToDecimal(cash),
      holdings: minorToDecimal(holdings),
      plans: minorToDecimal(plans),
      plansCount: Number(row.plans_count ?? 0),
      total: minorToDecimal(wallet + cash + holdings + plans),
      currency: "USD",
    };
  });
}

export type StaffMember = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  roleName: string | null;
  lastLoginAt: string | null;
};

export async function listStaff(): Promise<StaffMember[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT u.id, u.full_name, u.email, u.role, u.status, u.last_login_at, r.name AS role_name
    FROM app_users u LEFT JOIN admin_roles r ON r.id = u.admin_role_id
    WHERE u.role IN ('admin','compliance')
    ORDER BY u.created_at ASC
  `);
  return found.map((row) => ({
    id: String(row.id),
    name: String(row.full_name),
    email: String(row.email),
    role: String(row.role),
    status: String(row.status),
    roleName: row.role_name ? String(row.role_name) : null,
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
  }));
}

export type AdminRole = {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  members: number;
};

export async function listRoles(): Promise<AdminRole[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT r.id, r.name, r.description, r.permissions,
           (SELECT count(*)::int FROM app_users u WHERE u.admin_role_id = r.id) AS members
    FROM admin_roles r ORDER BY r.name ASC
  `);
  return found.map((row) => {
    let permissions: string[] = [];
    if (Array.isArray(row.permissions)) permissions = row.permissions.map(String);
    else if (typeof row.permissions === "string") {
      try {
        const parsed: unknown = JSON.parse(row.permissions);
        if (Array.isArray(parsed)) permissions = parsed.map(String);
      } catch {
        permissions = [];
      }
    }
    return {
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      permissions,
      members: Number(row.members ?? 0),
    };
  });
}

export async function listPermissions() {
  const sql = getSql();
  return rows<{ code: string; label: string; category: string }>(await sql`
    SELECT code, label, category FROM admin_permissions ORDER BY category, code
  `);
}

export async function setStaffAccess(
  actorUserId: string,
  targetUserId: string,
  input: Record<string, unknown>,
): Promise<Outcome<{ role: string }>> {
  if (!UUID.test(targetUserId)) return { ok: false, status: 400, error: "Unknown staff account." };
  if (targetUserId === actorUserId) {
    return { ok: false, status: 409, error: "You cannot change your own staff access here." };
  }
  const role = String(input.role ?? "").trim().toLowerCase();
  if (!["customer", "compliance", "admin"].includes(role)) {
    return { ok: false, status: 400, error: "Choose customer, compliance or admin." };
  }
  const roleId = typeof input.adminRoleId === "string" && UUID.test(input.adminRoleId) ? input.adminRoleId : null;
  const sql = getSql();

  if (role !== "admin") {
    const admins = rows<{ total: number }>(await sql`SELECT count(*)::int AS total FROM app_users WHERE role = 'admin'`);
    const target = rows<{ role: string }>(await sql`SELECT role FROM app_users WHERE id = ${targetUserId} LIMIT 1`);
    if (target[0]?.role === "admin" && Number(admins[0]?.total ?? 0) <= 1) {
      return { ok: false, status: 409, error: "The platform must keep at least one administrator." };
    }
  }

  const updated = rows<{ id: string }>(await sql`
    WITH target AS (
      UPDATE app_users SET role = ${role}, admin_role_id = ${roleId}, updated_at = now()
      WHERE id = ${targetUserId} AND role IN ('customer','admin','compliance')
      RETURNING id
    ), audited AS (
      INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
      SELECT ${actorUserId}, 'staff.access_changed', 'app_user', target.id::text,
             jsonb_build_object('role', ${role}::text)
      FROM target RETURNING id
    )
    SELECT id::text AS id FROM target
  `);
  if (!updated[0]) return { ok: false, status: 404, error: "That staff account was not found." };
  return { ok: true, value: { role } };
}

export async function saveRole(
  actorUserId: string,
  input: Record<string, unknown>,
): Promise<Outcome<{ id: string }>> {
  const name = String(input.name ?? "").trim().slice(0, 80);
  const description = String(input.description ?? "").trim().slice(0, 300);
  const permissions = Array.isArray(input.permissions)
    ? Array.from(new Set(input.permissions.filter((item): item is string => typeof item === "string"))).slice(0, 40)
    : [];
  if (name.length < 2) return { ok: false, status: 400, error: "Enter a role name." };

  const sql = getSql();
  const id = typeof input.id === "string" && UUID.test(input.id) ? input.id : null;
  const saved = id
    ? rows<{ id: string }>(await sql`
        UPDATE admin_roles SET name = ${name}, description = ${description}, permissions = ${JSON.stringify(permissions)}::jsonb
        WHERE id = ${id} RETURNING id
      `)
    : rows<{ id: string }>(await sql`
        INSERT INTO admin_roles (name, description, permissions)
        VALUES (${name}, ${description}, ${JSON.stringify(permissions)}::jsonb)
        ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, permissions = EXCLUDED.permissions
        RETURNING id
      `);
  if (!saved[0]) return { ok: false, status: 503, error: "That role could not be saved." };

  await sql`
    INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
    VALUES (${actorUserId}, 'role.saved', 'admin_role', ${String(saved[0].id)}, ${JSON.stringify({ name, permissions })}::jsonb)
  `;
  return { ok: true, value: { id: String(saved[0].id) } };
}

export async function getPlatformSettings() {
  const sql = getSql();
  const found = rows<{ key: string; value: unknown; updated_at: string }>(await sql`
    SELECT key, value, updated_at FROM platform_settings ORDER BY key
  `);
  return found;
}

export type LiveChatProvider = "tawk" | "crisp" | "intercom" | "chatwoot";
export type LiveChatSettings = { enabled:boolean; provider:LiveChatProvider; siteId:string; siteUrl:string };
const DEFAULT_LIVE_CHAT:LiveChatSettings={enabled:true,provider:"tawk",siteId:"6a988eb8a0ffc53446f9b976/1k1hur10v",siteUrl:""};
function validLiveChatSettings(v:LiveChatSettings):boolean {
 if(v.provider==="tawk"){const [p,w]=v.siteId.split("/");return /^[a-f0-9]{16,64}$/i.test(p||"")&&/^[a-z0-9]{6,64}$/i.test(w||"");}
 if(v.provider==="crisp")return /^[a-f0-9-]{20,40}$/i.test(v.siteId);
 if(v.provider==="intercom")return /^[a-z0-9]{6,16}$/i.test(v.siteId);
 if(v.provider==="chatwoot"){if(!/^[a-z0-9_-]{8,128}$/i.test(v.siteId))return false;try{return new URL(v.siteUrl).protocol==="https:";}catch{return false;}}
 return false;
}
export async function getLiveChatSettings():Promise<LiveChatSettings>{
 const sql=getSql();const found=rows<{value:unknown}>(await sql`SELECT value FROM platform_settings WHERE key='live_chat' LIMIT 1`);
 const value=found[0]?.value;if(!value||typeof value!=="object"||Array.isArray(value))return DEFAULT_LIVE_CHAT;
 const saved=value as Record<string,unknown>;const provider=["tawk","crisp","intercom","chatwoot"].includes(String(saved.provider))?saved.provider as LiveChatProvider:"tawk";
 const legacy=typeof saved.propertyId==="string"&&typeof saved.widgetId==="string"?saved.propertyId+"/"+saved.widgetId:DEFAULT_LIVE_CHAT.siteId;
 const config:LiveChatSettings={enabled:saved.enabled===false?false:saved.enabled===true,provider,siteId:typeof saved.siteId==="string"?saved.siteId:legacy,siteUrl:typeof saved.siteUrl==="string"?saved.siteUrl:""};
 return validLiveChatSettings(config)?config:{...config,enabled:false,siteId:""};
}
export async function saveLiveChatSettings(actorUserId:string,value:LiveChatSettings):Promise<Outcome<{key:string}>>{
 if(!validLiveChatSettings(value))return {ok:false,status:400,error:"Invalid identifier or provider URL for the selected live chat provider."};
 const safeValue:LiveChatSettings={enabled:value.enabled,provider:value.provider,siteId:value.siteId,siteUrl:value.provider==="chatwoot"?new URL(value.siteUrl).origin:""};
 const sql=getSql();
 await sql`INSERT INTO platform_settings (key,value,updated_at,updated_by) VALUES ('live_chat',${JSON.stringify(safeValue)}::jsonb,now(),${actorUserId}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=now(),updated_by=EXCLUDED.updated_by`;
 await sql`INSERT INTO audit_events (actor_user_id,action,entity_type,entity_id,details) VALUES (${actorUserId},'live_chat.settings_updated','platform_setting','live_chat',${JSON.stringify({enabled:safeValue.enabled,provider:safeValue.provider})}::jsonb)`;
 return {ok:true,value:{key:"live_chat"}};
}
export async function savePlatformSetting(
  actorUserId: string,
  key: string,
  value: Record<string, unknown>,
): Promise<Outcome<{ key: string }>> {
  if (!["platform", "trading"].includes(key)) {
    return { ok: false, status: 400, error: "Unknown setting group." };
  }
  const sql = getSql();
  await sql`
    INSERT INTO platform_settings (key, value, updated_at, updated_by)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb, now(), ${actorUserId})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by
  `;
  await sql`
    INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, details)
    VALUES (${actorUserId}, 'settings.updated', 'platform_setting', ${key}, ${JSON.stringify(value)}::jsonb)
  `;
  return { ok: true, value: { key } };
}

export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorEmail: string | null;
  details: unknown;
  createdAt: string;
};

export async function listAuditEvents(limit = 200): Promise<AuditEvent[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT e.id::text AS id, e.action, e.entity_type, e.entity_id, e.details, e.created_at, u.email
    FROM audit_events e LEFT JOIN app_users u ON u.id = e.actor_user_id
    ORDER BY e.created_at DESC LIMIT ${limit}
  `);
  return found.map((row) => ({
    id: String(row.id),
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: row.entity_id ? String(row.entity_id) : null,
    actorEmail: row.email ? String(row.email) : null,
    details: row.details ?? {},
    createdAt: String(row.created_at),
  }));
}

export type LoginEventRow = {
  id: string;
  email: string;
  ip: string | null;
  success: boolean;
  reason: string | null;
  createdAt: string;
};

export async function listLoginHistory(userId: string, limit = 20): Promise<LoginEventRow[]> {
  const sql = getSql();
  const found = rows<Record<string, unknown>>(await sql`
    SELECT id::text AS id, email, ip, success, reason, created_at
    FROM login_events WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT ${limit}
  `);
  return found.map((row) => ({
    id: String(row.id),
    email: String(row.email),
    ip: row.ip ? String(row.ip) : null,
    success: Boolean(row.success),
    reason: row.reason ? String(row.reason) : null,
    createdAt: String(row.created_at),
  }));
}
