import { describe, it, expect } from "vitest";
import { compileRules, MAX_COMPILED_BYTES, PLACEHOLDER_COLLECTION } from "../src/compile";
import type { Rule } from "../src/types";

const rule = (over: Partial<Rule>): Rule => ({
  id: "r", name: "n", enabled: true, combinator: "and", message: "m", target: "$.cart",
  conditions: [{ type: "shipping_po_box", value: true }], ...over,
});

describe("compileRules", () => {
  it("drops disabled rules and uses short keys", () => {
    const res = compileRules([rule({ id: "a" }), rule({ id: "b", enabled: false })]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.compiled).toEqual({ v: 1, rules: [{ c: "and", k: [{ type: "shipping_po_box", value: true }], m: "m", t: "$.cart" }] });
  });

  it("collects input vars from tag/collection/customer/attribute conditions, deduped", () => {
    const res = compileRules([
      rule({ conditions: [
        { type: "line_quantity", op: "gt", value: 1, product: { kind: "tag", values: ["sale", "Sale", "new"] } },
        { type: "cart_has_product", op: "is", product: { kind: "collection", values: ["gid://shopify/Collection/1"] } },
        { type: "customer_tag", op: "is", values: ["wholesale"] },
        { type: "cart_attribute", key: "gift", op: "present" },
        { type: "cart_attribute", key: "note", op: "absent" },
      ] }),
    ]);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.inputVars).toEqual({
      tags: ["sale", "new"], collectionIds: ["gid://shopify/Collection/1"], customerTags: ["wholesale"],
      attr1: "gift", attr2: "note", attr3: "",
    });
    expect(res.compiled.attrs).toEqual(["gift", "note"]);
  });

  it("uses a placeholder collection id when none referenced", () => {
    const res = compileRules([rule({})]);
    if (!res.ok) throw new Error();
    expect(res.inputVars.collectionIds).toEqual([PLACEHOLDER_COLLECTION]);
  });

  it("rejects more than 3 distinct cart attribute keys", () => {
    const res = compileRules([rule({ conditions: ["a", "b", "c", "d"].map((k) => ({ type: "cart_attribute" as const, key: k, op: "present" as const })) })]);
    expect(res).toEqual({ ok: false, error: expect.stringContaining("3 cart attribute keys") });
  });

  it("rejects rule sets over the size budget", () => {
    const big = rule({ message: "x".repeat(299) });
    const many = Array.from({ length: 40 }, (_, i) => ({ ...big, id: String(i) }));
    const res = compileRules(many);
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain(String(MAX_COMPILED_BYTES));
  });
  it("accepts collection conditions that all use the same list (order/duplicates ignored)", () => {
    const res = compileRules([
      rule({ id: "a", conditions: [{ type: "cart_has_product", op: "is", product: { kind: "collection", values: ["gid://shopify/Collection/1", "gid://shopify/Collection/2"] } }] }),
      rule({ id: "b", conditions: [{ type: "line_quantity", op: "gt", value: 2, product: { kind: "collection", values: ["gid://shopify/Collection/2", "gid://shopify/Collection/1", "gid://shopify/Collection/1"] } }] }),
    ]);
    expect(res.ok).toBe(true);
    if (res.ok) expect([...res.inputVars.collectionIds].sort()).toEqual(["gid://shopify/Collection/1", "gid://shopify/Collection/2"]);
  });

  it("rejects collection conditions that use different lists across active rules", () => {
    const res = compileRules([
      rule({ id: "a", conditions: [{ type: "cart_has_product", op: "is", product: { kind: "collection", values: ["gid://shopify/Collection/1"] } }] }),
      rule({ id: "b", conditions: [{ type: "cart_has_product", op: "is", product: { kind: "collection", values: ["gid://shopify/Collection/2"] } }] }),
      rule({ id: "c", enabled: false, conditions: [{ type: "cart_has_product", op: "is", product: { kind: "collection", values: ["gid://shopify/Collection/3"] } }] }),
    ]);
    expect(res).toEqual({ ok: false, error: "All collection conditions in your active rules must use the same collection list (currently 2 different lists). Use product tags for finer targeting." });
  });
});
