import { describe, it, expect } from "vitest";
import { evaluateRules, evaluateCondition } from "../src/evaluate";
import type { CartSnapshot, CompiledRuleSet } from "../src/types";

const base = (over: Partial<CartSnapshot> = {}): CartSnapshot => ({
  step: "CHECKOUT_INTERACTION", subtotal: 120, itemCount: 3,
  lines: [
    { quantity: 2, variantId: "gid://shopify/ProductVariant/1", sku: "SKU-A", productTags: ["sale"], inAnyCollection: false },
    { quantity: 1, variantId: "gid://shopify/ProductVariant/2", sku: "SKU-B", productTags: [], inAnyCollection: true },
  ],
  customer: { loggedIn: true, tags: ["wholesale"], orderCount: 4, isB2B: false },
  shipping: { country: "US", province: "CA", zip: "90210", address1: "PO Box 12", address2: null },
  attributes: { gift: "yes" },
  poNumberPresent: false,
  ...over,
});

describe("evaluateCondition", () => {
  it("cart_subtotal ops", () => {
    expect(evaluateCondition({ type: "cart_subtotal", op: "gt", value: 100 }, base())).toBe(true);
    expect(evaluateCondition({ type: "cart_subtotal", op: "lt", value: 100 }, base())).toBe(false);
    expect(evaluateCondition({ type: "cart_subtotal", op: "eq", value: 120 }, base())).toBe(true);
    expect(evaluateCondition({ type: "cart_subtotal", op: "between", value: 100, value2: 150 }, base())).toBe(true);
    expect(evaluateCondition({ type: "cart_subtotal", op: "between", value: 121, value2: 150 }, base())).toBe(false);
  });
  it("cart_item_count", () => {
    expect(evaluateCondition({ type: "cart_item_count", op: "gt", value: 2 }, base())).toBe(true);
  });
  it("line_quantity with product filters", () => {
    expect(evaluateCondition({ type: "line_quantity", op: "gt", value: 1, product: { kind: "any" } }, base())).toBe(true);
    expect(evaluateCondition({ type: "line_quantity", op: "gt", value: 1, product: { kind: "tag", values: ["sale"] } }, base())).toBe(true);
    expect(evaluateCondition({ type: "line_quantity", op: "gt", value: 1, product: { kind: "sku", values: ["SKU-B"] } }, base())).toBe(false);
    expect(evaluateCondition({ type: "line_quantity", op: "gt", value: 0, product: { kind: "collection", values: ["gid://shopify/Collection/9"] } }, base())).toBe(true);
    expect(evaluateCondition({ type: "line_quantity", op: "gt", value: 0, product: { kind: "variant", values: ["gid://shopify/ProductVariant/2"] } }, base())).toBe(true);
  });
  it("cart_has_product", () => {
    expect(evaluateCondition({ type: "cart_has_product", op: "is", product: { kind: "tag", values: ["sale"] } }, base())).toBe(true);
    expect(evaluateCondition({ type: "cart_has_product", op: "is_not", product: { kind: "tag", values: ["sale"] } }, base())).toBe(false);
  });
  it("customer conditions", () => {
    expect(evaluateCondition({ type: "customer_tag", op: "is", values: ["wholesale"] }, base())).toBe(true);
    expect(evaluateCondition({ type: "customer_tag", op: "is_not", values: ["vip"] }, base())).toBe(true);
    expect(evaluateCondition({ type: "customer_logged_in", value: false }, base())).toBe(false);
    expect(evaluateCondition({ type: "customer_order_count", op: "lt", value: 5 }, base())).toBe(true);
    expect(evaluateCondition({ type: "customer_is_b2b", value: true }, base())).toBe(false);
  });
  it("shipping conditions", () => {
    expect(evaluateCondition({ type: "shipping_country", op: "is", values: ["US", "CA"] }, base())).toBe(true);
    expect(evaluateCondition({ type: "shipping_country", op: "is_not", values: ["US"] }, base())).toBe(false);
    expect(evaluateCondition({ type: "shipping_province", op: "is", values: ["CA"] }, base())).toBe(true);
    expect(evaluateCondition({ type: "shipping_zip", op: "matches", value: "^902" }, base())).toBe(true);
    expect(evaluateCondition({ type: "shipping_zip", op: "contains", value: "021" }, base())).toBe(true);
    expect(evaluateCondition({ type: "shipping_zip", op: "is", value: "90210" }, base())).toBe(true);
    expect(evaluateCondition({ type: "shipping_po_box", value: true }, base())).toBe(true);
    expect(evaluateCondition({ type: "shipping_address_length", op: "lt", value: 10 }, base())).toBe(true);
  });
  it("shipping conditions are false when there is no shipping address yet", () => {
    const cart = base({ shipping: null });
    expect(evaluateCondition({ type: "shipping_country", op: "is", values: ["US"] }, cart)).toBe(false);
    expect(evaluateCondition({ type: "shipping_po_box", value: true }, cart)).toBe(false);
  });
  it("attributes and PO number", () => {
    expect(evaluateCondition({ type: "cart_attribute", key: "gift", op: "present" }, base())).toBe(true);
    expect(evaluateCondition({ type: "cart_attribute", key: "gift", op: "equals", value: "yes" }, base())).toBe(true);
    expect(evaluateCondition({ type: "cart_attribute", key: "nope", op: "absent" }, base())).toBe(true);
    expect(evaluateCondition({ type: "po_number_present", value: false }, base())).toBe(true);
  });
  it("invalid regex never throws", () => {
    expect(evaluateCondition({ type: "shipping_zip", op: "matches", value: "(" }, base())).toBe(false);
  });
});

describe("evaluateRules", () => {
  const set: CompiledRuleSet = {
    v: 1,
    rules: [
      { c: "and", k: [{ type: "shipping_po_box", value: true }], m: "No PO boxes", t: "$.cart.deliveryGroups[0].deliveryAddress.address1" },
      { c: "or", k: [{ type: "cart_subtotal", op: "gt", value: 1000 }, { type: "customer_tag", op: "is", values: ["wholesale"] }], m: "Wholesale", t: "$.cart" },
      { c: "and", k: [{ type: "cart_subtotal", op: "gt", value: 1000 }, { type: "customer_tag", op: "is", values: ["wholesale"] }], m: "Never", t: "$.cart" },
    ],
  };
  it("returns one error per matching rule, in order", () => {
    expect(evaluateRules(set, base())).toEqual([
      { message: "No PO boxes", target: "$.cart.deliveryGroups[0].deliveryAddress.address1" },
      { message: "Wholesale", target: "$.cart" },
    ]);
  });
  it("returns nothing for an empty set", () => {
    expect(evaluateRules({ v: 1, rules: [] }, base())).toEqual([]);
  });
  it("never blocks during CART_INTERACTION (validation only at checkout steps)", () => {
    expect(evaluateRules(set, base({ step: "CART_INTERACTION" }))).toEqual([]);
    expect(evaluateRules(set, base({ step: "CHECKOUT_COMPLETION" }))).toHaveLength(2);
  });
  it("an 'and' rule with no conditions never matches", () => {
    expect(evaluateRules({ v: 1, rules: [{ c: "and", k: [], m: "Empty", t: "$.cart" }] }, base())).toEqual([]);
    expect(evaluateRules({ v: 1, rules: [{ c: "or", k: [], m: "Empty", t: "$.cart" }] }, base())).toEqual([]);
  });
});
