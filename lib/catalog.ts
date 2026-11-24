import "server-only";
import { getSql } from "@/lib/db";
import { decimalToMinor, minorToDecimal } from "@/lib/money";
import { audit, getProduct, type ProductCategory } from "@/lib/marketplace";

/**
 * Investment product (plan) administration.
 *
 * Products describe a mandate: minimum, term, fees, risk classification and
 * allocation. No field promises a return. Publishing only changes availability;
 * customer money moves solely through the reviewed investment workflow.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CATEGORIES: ProductCategory[] = ["stocks", "etfs", "bonds", "mutual_funds", "crypto", "portfolio"];
const RISKS = ["low", "medium", "high"];
const STATUSES = ["draft", "active", "paused", "retired"];

export type CatalogOutcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clean(value: unknown, max: number) {
  return text(value).replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").slice(0, max);
}

function allocation(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const percent = Number(raw);
    if (key.length > 0 && key.length <= 40 && Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      result[clean(key, 40)] = Math.round(percent * 100) / 100;
    }
  }
  return result;
}

type Normalised = {
  name: string;
  description: string;
  summary: string;
  currency: string;
  minimumAmount: string;
  category: ProductCategory;
  riskLevel: string;
  durationDays: number | null;
  feeBps: number;
  managementFeeBps: number;
  expenseRatio: string | null;
  couponRate: string | null;
  yieldRate: string | null;
  maturityDate: string | null;
  allocation: Record<string, number>;
  status: string;
  termsVersion: string | null;
};

function normalise(input: Record<string, unknown>, partial = false): CatalogOutcome<Partial<Normalised>> {
  const output: Partial<Normalised> = {};

  if (!partial || input.name !== undefined) {
    const name = clean(input.name, 120);
    if (name.length < 3) return { ok: false, status: 400, error: "Enter a product name." };
    output.name = name;
  }
  if (!partial || input.description !== undefined) {
    const description = clean(input.description, 2000);
    if (description.length < 20) return { ok: false, status: 400, error: "Describe the mandate in at least 20 characters." };
    output.description = description;
  }
  if (!partial || input.summary !== undefined) output.summary = clean(input.summary, 300);
  if (!partial || input.currency !== undefined) {
    const currency = text(input.currency).toUpperCase();
    if (!["USD", "EUR", "GBP"].includes(currency)) return { ok: false, status: 400, error: "Choose USD, EUR or GBP." };
    output.currency = currency;
  }
  if (!partial || input.minimumAmount !== undefined) {
    const minor = decimalToMinor(input.minimumAmount as string);
    if (minor === null || minor <= 0) return { ok: false, status: 400, error: "Enter a minimum above zero." };
    output.minimumAmount = minorToDecimal(minor);
  }
  if (!partial || input.category !== undefined) {
    const category = text(input.category) as ProductCategory;
    if (!CATEGORIES.includes(category)) return { ok: false, status: 400, error: "Choose a valid category." };
    output.category = category;
  }
  if (!partial || input.riskLevel !== undefined) {
    const risk = text(input.riskLevel).toLowerCase();
    if (!RISKS.includes(risk)) return { ok: false, status: 400, error: "Choose a risk classification." };
    output.riskLevel = risk;
  }
  if (!partial || input.durationDays !== undefined) {
    if (input.durationDays === null || input.durationDays === "" || input.durationDays === undefined) {
      output.durationDays = null;
    } else {
      const days = Number(input.durationDays);
      if (!Number.isInteger(days) || days <= 0 || days > 3650) {
        return { ok: false, status: 400, error: "Enter a term between 1 and 3650 days, or leave it open-ended." };
      }
      output.durationDays = days;
    }
  }
  for (const key of ["feeBps", "managementFeeBps"] as const) {
    if (!partial || input[key] !== undefined) {
      const value = Number(input[key] ?? 0);
      if (!Number.isInteger(value) || value < 0 || value > 2000) {
        return { ok: false, status: 400, error: "Fees must be a whole number of basis points between 0 and 2000." };
      }
      output[key] = value;
    }
  }
  for (const key of ["expenseRatio", "couponRate", "yieldRate"] as const) {
    if (!partial || input[key] !== undefined) {
      const raw = text(input[key]);
      if (!raw) {
        output[key] = null;
      } else {
        const percent = Number(raw);
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          return { ok: false, status: 400, error: "Percentages must be between 0 and 100." };
        }
        output[key] = (percent / 100).toFixed(4);
      }
    }
  }
  if (!partial || input.maturityDate !== undefined) {
    const raw = text(input.maturityDate);
    if (!raw) output.maturityDate = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return { ok: false, status: 400, error: "Enter maturity as YYYY-MM-DD." };
    else output.maturityDate = raw;
  }
  if (!partial || input.allocation !== undefined) output.allocation = allocation(input.allocation);
  if (!partial || input.status !== undefined) {
    const status = text(input.status).toLowerCase() || "draft";
    if (!STATUSES.includes(status)) return { ok: false, status: 400, error: "Choose draft, active, paused or retired." };
    output.status = status;
  }
  if (!partial || input.termsVersion !== undefined) output.termsVersion = clean(input.termsVersion, 40) || null;
  return { ok: true, value: output };
}

export async function createProduct(
  actorUserId: string,
  input: Record<string, unknown>,
): Promise<CatalogOutcome<{ id: string }>> {
  const normalised = normalise(input);
  if (!normalised.ok) return normalised;
  const value = normalised.value as Normalised;
  const sql = getSql();
  const created = rows<{ id: string }>(await sql`
    INSERT INTO investment_products
      (name, description, summary, currency, minimum_amount, category, risk_level, duration_days,
       fee_bps, management_fee_bps, expense_ratio, coupon_rate, yield_rate, maturity_date,
       allocation, status, terms_version, published_at)
    VALUES (${value.name}, ${value.description}, ${value.summary}, ${value.currency}, ${value.minimumAmount}::numeric,
            ${value.category}, ${value.riskLevel}, ${value.durationDays}, ${value.feeBps}, ${value.managementFeeBps},
            ${value.expenseRatio}::numeric, ${value.couponRate}::numeric, ${value.yieldRate}::numeric,
            ${value.maturityDate}::date, ${JSON.stringify(value.allocation)}::jsonb, ${value.status},
            ${value.termsVersion}, ${value.status === "active" ? new Date().toISOString() : null})
    RETURNING id
  `);
  if (!created[0]) return { ok: false, status: 503, error: "That product could not be created." };
  await audit(actorUserId, "product.created", "investment_product", String(created[0].id), {
    name: value.name,
    category: value.category,
    status: value.status,
  });
  return { ok: true, value: { id: String(created[0].id) } };
}

export async function updateProduct(
  actorUserId: string,
  productId: string,
  input: Record<string, unknown>,
): Promise<CatalogOutcome<{ id: string; status: string }>> {
  if (!UUID.test(productId)) return { ok: false, status: 400, error: "Unknown product." };
  const existing = await getProduct(productId);
  if (!existing) return { ok: false, status: 404, error: "That product was not found." };

  const normalised = normalise(input, true);
  if (!normalised.ok) return normalised;
  const value = normalised.value;

  const sql = getSql();
  const updated = rows<{ id: string; status: string }>(await sql`
    UPDATE investment_products SET
      name = COALESCE(${value.name ?? null}, name),
      description = COALESCE(${value.description ?? null}, description),
      summary = COALESCE(${value.summary ?? null}, summary),
      currency = COALESCE(${value.currency ?? null}, currency),
      minimum_amount = COALESCE(${value.minimumAmount ?? null}::numeric, minimum_amount),
      category = COALESCE(${value.category ?? null}, category),
      risk_level = COALESCE(${value.riskLevel ?? null}, risk_level),
      duration_days = CASE WHEN ${value.durationDays === undefined}::boolean THEN duration_days ELSE ${value.durationDays ?? null} END,
      fee_bps = COALESCE(${value.feeBps ?? null}::int, fee_bps),
      management_fee_bps = COALESCE(${value.managementFeeBps ?? null}::int, management_fee_bps),
      expense_ratio = CASE WHEN ${value.expenseRatio === undefined}::boolean THEN expense_ratio ELSE ${value.expenseRatio ?? null}::numeric END,
      coupon_rate = CASE WHEN ${value.couponRate === undefined}::boolean THEN coupon_rate ELSE ${value.couponRate ?? null}::numeric END,
      yield_rate = CASE WHEN ${value.yieldRate === undefined}::boolean THEN yield_rate ELSE ${value.yieldRate ?? null}::numeric END,
      maturity_date = CASE WHEN ${value.maturityDate === undefined}::boolean THEN maturity_date ELSE ${value.maturityDate ?? null}::date END,
      allocation = COALESCE(${value.allocation === undefined ? null : JSON.stringify(value.allocation)}::jsonb, allocation),
      status = COALESCE(${value.status ?? null}, status),
      terms_version = CASE WHEN ${value.termsVersion === undefined}::boolean THEN terms_version ELSE ${value.termsVersion ?? null} END,
      published_at = CASE WHEN ${value.status ?? null} = 'active' AND published_at IS NULL THEN now() ELSE published_at END,
      updated_at = now()
    WHERE id = ${productId}
    RETURNING id, status
  `);
  if (!updated[0]) return { ok: false, status: 404, error: "That product was not found." };
  await audit(actorUserId, "product.updated", "investment_product", productId, {
    status: updated[0].status,
    fields: Object.keys(value).join(","),
  });
  return { ok: true, value: { id: String(updated[0].id), status: String(updated[0].status) } };
}

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as T[]) : [];
}
