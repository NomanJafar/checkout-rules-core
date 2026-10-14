import { describe, it, expect } from "vitest";
import { RuleSchema, normalizeProductIds } from "../src/schema";

describe("RuleSchema", () => {
  it("accepts a valid max-quantity rule", () => {
    const rule = {
      id: "r1", name: "Max 5 per product", enabled: true, combinator: "and",
      conditions: [{ type: "line_quantity", op: "gt", value: 5, product: { kind: "any" } }],
      message: "You can buy at most 5 of each item.", target: "$.cart",
    };
    expect(RuleSchema.parse(rule)).toEqual(rule);
  });

  it("rejects an unknown condition type", () => {
    const r = RuleSchema.safeParse({
      id: "r", name: "x", enabled: true, combinator: "and",
      conditions: [{ type: "nope" }], message: "m", target: "$.cart",
    });
    expect(r.success).toBe(false);
  });

  it("requires value2 for between", () => {
    const r = RuleSchema.safeParse({
      id: "r", name: "x", enabled: true, combinator: "or",
      conditions: [{ type: "cart_subtotal", op: "between", value: 10 }],
      message: "m", target: "$.cart",
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty message or no conditions", () => {
    expect(RuleSchema.safeParse({ id: "r", name: "x", enabled: true, combinator: "and", conditions: [], message: "m", target: "$.cart" }).success).toBe(false);
    expect(RuleSchema.safeParse({ id: "r", name: "x", enabled: true, combinator: "and", conditions: [{ type: "shipping_po_box", value: true }], message: "", target: "$.cart" }).success).toBe(false);
  });
  const withProduct = (product: unknown) => ({
    id: "r", name: "x", enabled: true, combinator: "and", message: "m", target: "$.cart",
    conditions: [{ type: "cart_has_product", op: "is", product }],
  });
  it("accepts collection and variant GIDs", () => {
    expect(RuleSchema.safeParse(withProduct({ kind: "collection", values: ["gid://shopify/Collection/123456"] })).success).toBe(true);
    expect(RuleSchema.safeParse(withProduct({ kind: "variant", values: ["gid://shopify/ProductVariant/42"] })).success).toBe(true);
  });
  it("rejects malformed collection and variant ids with a helpful message", () => {
    const c = RuleSchema.safeParse(withProduct({ kind: "collection", values: ["summer sale"] }));
    expect(c.success).toBe(false);
    if (!c.success) expect(c.error.issues[0].message).toBe("Enter a collection ID like 123456 or gid://shopify/Collection/123456");
    const v = RuleSchema.safeParse(withProduct({ kind: "variant", values: ["gid://shopify/Collection/1"] }));
    expect(v.success).toBe(false);
    if (!v.success) expect(v.error.issues[0].message).toBe("Enter a variant ID like 123456 or gid://shopify/ProductVariant/123456");
  });
});

describe("normalizeProductIds", () => {
  it("converts bare numeric collection/variant ids to GIDs and leaves everything else alone", () => {
    const input = [
      { type: "cart_has_product", op: "is", product: { kind: "collection", values: [" 123456 ", "gid://shopify/Collection/7"] } },
      { type: "line_quantity", op: "gt", value: 1, product: { kind: "variant", values: ["42"] } },
      { type: "line_quantity", op: "gt", value: 1, product: { kind: "sku", values: ["123"] } },
      { type: "shipping_po_box", value: true },
    ];
    expect(normalizeProductIds(input)).toEqual([
      { type: "cart_has_product", op: "is", product: { kind: "collection", values: ["gid://shopify/Collection/123456", "gid://shopify/Collection/7"] } },
      { type: "line_quantity", op: "gt", value: 1, product: { kind: "variant", values: ["gid://shopify/ProductVariant/42"] } },
      { type: "line_quantity", op: "gt", value: 1, product: { kind: "sku", values: ["123"] } },
      { type: "shipping_po_box", value: true },
    ]);
  });
  it("passes non-array input through unchanged", () => {
    expect(normalizeProductIds("nope")).toBe("nope");
  });
});
