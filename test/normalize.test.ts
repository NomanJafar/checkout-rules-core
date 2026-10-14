import { describe, it, expect } from "vitest";
import { normalizeInput, type FunctionInput } from "../src/normalize";
import type { InputVars } from "../src/types";

const vars: InputVars = { tags: ["sale", "new"], collectionIds: ["gid://shopify/Collection/1"], customerTags: ["wholesale"], attr1: "gift", attr2: "", attr3: "" };

const input: FunctionInput = {
  buyerJourney: { step: "CHECKOUT_INTERACTION" },
  validation: { metafield: { jsonValue: { v: 1, rules: [] } } },
  cart: {
    cost: { subtotalAmount: { amount: "120.50" } },
    attr1: { value: "yes" }, attr2: null, attr3: null,
    poNumber: "PO-1",
    buyerIdentity: {
      isAuthenticated: true,
      purchasingCompany: { company: { id: "gid://shopify/Company/1" } },
      customer: { numberOfOrders: 4, hasTags: [{ tag: "wholesale", hasTag: true }] },
    },
    deliveryGroups: [{ deliveryAddress: { countryCode: "US", provinceCode: "CA", zip: "90210", address1: "PO Box 1", address2: null } }],
    lines: [
      { quantity: 2, merchandise: { __typename: "ProductVariant", id: "gid://shopify/ProductVariant/1", sku: "A", product: { hasTags: [{ tag: "sale", hasTag: true }, { tag: "new", hasTag: false }], inAnyCollection: false } } },
      { quantity: 1, merchandise: { __typename: "CustomProduct" } },
    ],
  },
};

describe("normalizeInput", () => {
  it("maps the function input to a CartSnapshot", () => {
    expect(normalizeInput(input, vars)).toEqual({
      step: "CHECKOUT_INTERACTION", subtotal: 120.5, itemCount: 3,
      lines: [{ quantity: 2, variantId: "gid://shopify/ProductVariant/1", sku: "A", productTags: ["sale"], inAnyCollection: false }],
      customer: { loggedIn: true, tags: ["wholesale"], orderCount: 4, isB2B: true },
      shipping: { country: "US", province: "CA", zip: "90210", address1: "PO Box 1", address2: null },
      attributes: { gift: "yes" },
      poNumberPresent: true,
    });
  });

  it("handles guest carts with no address", () => {
    const guest: FunctionInput = { ...input, cart: { ...input.cart, buyerIdentity: null, deliveryGroups: [], poNumber: null, attr1: null } };
    const s = normalizeInput(guest, vars);
    expect(s.customer).toEqual({ loggedIn: false, tags: [], orderCount: 0, isB2B: false });
    expect(s.shipping).toBeNull();
    expect(s.poNumberPresent).toBe(false);
    expect(s.attributes).toEqual({});
  });

  it("ignores the attribute when its key var is empty", () => {
    const noKeyVars: InputVars = { ...vars, attr1: "" };
    const s = normalizeInput(input, noKeyVars);
    expect(s.attributes).toEqual({});
  });
});
