import { z } from "zod";
import { ERROR_TARGETS } from "./types";

const numberOp = z.enum(["lt", "gt", "eq", "between"]);
const setOp = z.enum(["is", "is_not"]);
const textOp = z.enum(["is", "is_not", "contains", "matches"]);
const strList = z.array(z.string().min(1)).min(1, "Enter at least one value").max(50);

const COLLECTION_GID = /^gid:\/\/shopify\/Collection\/\d+$/;
const VARIANT_GID = /^gid:\/\/shopify\/ProductVariant\/\d+$/;
const gidList = (re: RegExp, message: string) => z.array(z.string().regex(re, message)).min(1, "Enter at least one value").max(50);

/**
 * Admin forms accept bare numeric ids ("123456"); convert them to GIDs before validation.
 * Walks an untrusted conditions array and returns a new one; non-arrays pass through unchanged.
 */
export function normalizeProductIds(conditions: unknown): unknown {
  if (!Array.isArray(conditions)) return conditions;
  const prefix: Record<string, string> = { collection: "gid://shopify/Collection/", variant: "gid://shopify/ProductVariant/" };
  return conditions.map((c) => {
    const product = c && typeof c === "object" ? (c as { product?: unknown }).product : undefined;
    if (!product || typeof product !== "object") return c;
    const { kind, values } = product as { kind?: unknown; values?: unknown };
    if (typeof kind !== "string" || !(kind in prefix) || !Array.isArray(values)) return c;
    const fixed = values.map((v) => (typeof v === "string" && /^\s*\d+\s*$/.test(v) ? prefix[kind] + v.trim() : v));
    return { ...c, product: { ...product, values: fixed } };
  });
}

const numberCmp = {
  op: numberOp,
  value: z.number().finite(),
  value2: z.number().finite().optional(),
};

export const ProductFilterSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("any") }),
  z.object({ kind: z.literal("tag"), values: strList }),
  z.object({ kind: z.literal("collection"), values: gidList(COLLECTION_GID, "Enter a collection ID like 123456 or gid://shopify/Collection/123456") }),
  z.object({ kind: z.literal("sku"), values: strList }),
  z.object({ kind: z.literal("variant"), values: gidList(VARIANT_GID, "Enter a variant ID like 123456 or gid://shopify/ProductVariant/123456") }),
]);

export const ConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("cart_subtotal"), ...numberCmp }),
  z.object({ type: z.literal("cart_item_count"), ...numberCmp }),
  z.object({ type: z.literal("line_quantity"), product: ProductFilterSchema, ...numberCmp }),
  z.object({ type: z.literal("cart_has_product"), op: setOp, product: ProductFilterSchema }),
  z.object({ type: z.literal("customer_tag"), op: setOp, values: strList }),
  z.object({ type: z.literal("customer_logged_in"), value: z.boolean() }),
  z.object({ type: z.literal("customer_order_count"), ...numberCmp }),
  z.object({ type: z.literal("customer_is_b2b"), value: z.boolean() }),
  z.object({ type: z.literal("shipping_country"), op: setOp, values: strList }),
  z.object({ type: z.literal("shipping_province"), op: setOp, values: strList }),
  z.object({ type: z.literal("shipping_zip"), op: textOp, value: z.string().min(1).max(200) }),
  z.object({ type: z.literal("shipping_po_box"), value: z.boolean() }),
  z.object({ type: z.literal("shipping_address_length"), ...numberCmp }),
  z.object({ type: z.literal("cart_attribute"), key: z.string().min(1).max(100), op: z.enum(["present", "absent", "equals"]), value: z.string().max(200).optional() }),
  z.object({ type: z.literal("po_number_present"), value: z.boolean() }),
]);

export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  enabled: z.boolean(),
  combinator: z.enum(["and", "or"]),
  conditions: z.array(ConditionSchema).min(1).max(10),
  message: z.string().min(1).max(300),
  target: z.enum(ERROR_TARGETS),
}).superRefine((rule, ctx) => {
  rule.conditions.forEach((condition, i) => {
    if ("op" in condition && condition.op === "between" && condition.value2 === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["conditions", i, "value2"],
        message: "value2 required for between operator",
      });
    }
  });
});

export type RuleInput = z.input<typeof RuleSchema>;
