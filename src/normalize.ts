import type { CartSnapshot, InputVars } from "./types";

export interface FunctionInput {
  buyerJourney: { step: CartSnapshot["step"] };
  validation: { metafield: { jsonValue: unknown } | null } | null;
  cart: {
    cost: { subtotalAmount: { amount: string } };
    attr1: { value: string | null } | null;
    attr2: { value: string | null } | null;
    attr3: { value: string | null } | null;
    poNumber: string | null;
    buyerIdentity: {
      isAuthenticated: boolean;
      purchasingCompany: { company: { id: string } } | null;
      customer: { numberOfOrders: number; hasTags: Array<{ tag: string; hasTag: boolean }> } | null;
    } | null;
    deliveryGroups: Array<{
      deliveryAddress: { countryCode: string | null; provinceCode: string | null; zip: string | null; address1: string | null; address2: string | null } | null;
    }>;
    lines: Array<{
      quantity: number;
      merchandise:
        | { __typename: "ProductVariant"; id: string; sku: string | null; product: { hasTags: Array<{ tag: string; hasTag: boolean }>; inAnyCollection: boolean } }
        | { __typename: string };
    }>;
  };
}

export function normalizeInput(input: FunctionInput, vars: InputVars): CartSnapshot {
  const cart = input.cart;
  const lines: CartSnapshot["lines"] = [];
  let itemCount = 0;
  // Plain indexed loops: this runs per cart line inside the Function's instruction budget
  // (200-line carts must stay under 11M instructions), where each array helper call counts.
  type ProductVariantMerchandise = Extract<FunctionInput["cart"]["lines"][number]["merchandise"], { __typename: "ProductVariant" }>;
  const inLines = cart.lines;
  for (let i = 0; i < inLines.length; i++) {
    const l = inLines[i];
    itemCount += l.quantity;
    if (l.merchandise.__typename !== "ProductVariant") continue;
    const m = l.merchandise as ProductVariantMerchandise;
    const hasTags = m.product.hasTags;
    const productTags: string[] = [];
    for (let j = 0; j < hasTags.length; j++) if (hasTags[j].hasTag) productTags.push(hasTags[j].tag);
    lines.push({ quantity: l.quantity, variantId: m.id, sku: m.sku, productTags, inAnyCollection: m.product.inAnyCollection });
  }
  const bi = cart.buyerIdentity;
  const addr = cart.deliveryGroups[0]?.deliveryAddress ?? null;
  const attributes: Record<string, string> = {};
  for (const [i, a] of [cart.attr1, cart.attr2, cart.attr3].entries()) {
    const key = vars[`attr${i + 1}` as "attr1" | "attr2" | "attr3"];
    if (key && a && a.value !== null) attributes[key] = a.value;
  }
  return {
    step: input.buyerJourney.step,
    subtotal: Number(cart.cost.subtotalAmount.amount) || 0,
    itemCount,
    lines,
    customer: {
      loggedIn: bi?.isAuthenticated ?? false,
      tags: bi?.customer?.hasTags.filter((t) => t.hasTag).map((t) => t.tag) ?? [],
      orderCount: bi?.customer?.numberOfOrders ?? 0,
      isB2B: Boolean(bi?.purchasingCompany?.company?.id),
    },
    shipping: addr ? { country: addr.countryCode, province: addr.provinceCode, zip: addr.zip, address1: addr.address1, address2: addr.address2 } : null,
    attributes,
    poNumberPresent: Boolean(cart.poNumber),
  };
}
