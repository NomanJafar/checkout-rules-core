export type Combinator = "and" | "or";
export type NumberOp = "lt" | "gt" | "eq" | "between";
export type SetOp = "is" | "is_not";
export type TextOp = "is" | "is_not" | "contains" | "matches";

/**
 * Limitation: the Function input query asks a single `inAnyCollection(ids: $collectionIds)`
 * question per cart line, so a `collection` filter means "in any of the shared collection list".
 * compileRules therefore rejects active rule sets whose collection conditions use different
 * lists; merchants needing finer targeting should use product tags (one hasTags answer per tag).
 */
export type ProductFilter =
  | { kind: "any" }
  | { kind: "tag"; values: string[] }
  | { kind: "collection"; values: string[] } // Collection GIDs
  | { kind: "sku"; values: string[] }
  | { kind: "variant"; values: string[] }; // ProductVariant GIDs

export interface NumberCmp { op: NumberOp; value: number; value2?: number }

export type Condition =
  | ({ type: "cart_subtotal" } & NumberCmp)
  | ({ type: "cart_item_count" } & NumberCmp)
  | ({ type: "line_quantity"; product: ProductFilter } & NumberCmp)
  | { type: "cart_has_product"; op: SetOp; product: ProductFilter }
  | { type: "customer_tag"; op: SetOp; values: string[] }
  | { type: "customer_logged_in"; value: boolean }
  | ({ type: "customer_order_count" } & NumberCmp)
  | { type: "customer_is_b2b"; value: boolean }
  | { type: "shipping_country"; op: SetOp; values: string[] } // ISO 3166-1 alpha-2
  | { type: "shipping_province"; op: SetOp; values: string[] } // province codes
  | { type: "shipping_zip"; op: TextOp; value: string }
  | { type: "shipping_po_box"; value: boolean }
  | ({ type: "shipping_address_length" } & NumberCmp)
  | { type: "cart_attribute"; key: string; op: "present" | "absent" | "equals"; value?: string }
  | { type: "po_number_present"; value: boolean };

export const ERROR_TARGETS = [
  "$.cart",
  "$.cart.buyerIdentity.email",
  "$.cart.buyerIdentity.phone",
  "$.cart.deliveryGroups[0].deliveryAddress.address1",
  "$.cart.deliveryGroups[0].deliveryAddress.address2",
  "$.cart.deliveryGroups[0].deliveryAddress.city",
  "$.cart.deliveryGroups[0].deliveryAddress.zip",
  "$.cart.deliveryGroups[0].deliveryAddress.countryCode",
  "$.cart.poNumber",
] as const;
export type ErrorTarget = (typeof ERROR_TARGETS)[number];

export interface Rule {
  id: string;
  name: string;
  enabled: boolean;
  combinator: Combinator;
  conditions: Condition[];
  message: string;
  target: ErrorTarget;
}

/** What the Function actually evaluates. Only enabled rules; short keys to stay under 9.5 kB. */
export interface CompiledRule { c: Combinator; k: Condition[]; m: string; t: ErrorTarget }
export interface CompiledRuleSet { v: 1; rules: CompiledRule[]; attrs?: string[] }

/** Variables injected into the Function input query via [extensions.input.variables]. */
export interface InputVars {
  tags: string[];
  collectionIds: string[];
  customerTags: string[];
  attr1: string;
  attr2: string;
  attr3: string;
}

/** Platform-independent view of a cart, produced by normalize.ts and by the admin preview form. */
export interface CartSnapshot {
  step: "CART_INTERACTION" | "CHECKOUT_INTERACTION" | "CHECKOUT_COMPLETION";
  subtotal: number;
  itemCount: number;
  lines: Array<{
    quantity: number;
    variantId: string;
    sku: string | null;
    productTags: string[]; // only tags we asked about (from InputVars.tags) that the product has
    inAnyCollection: boolean; // true if product is in any of InputVars.collectionIds
  }>;
  customer: { loggedIn: boolean; tags: string[]; orderCount: number; isB2B: boolean };
  shipping: { country: string | null; province: string | null; zip: string | null; address1: string | null; address2: string | null } | null;
  attributes: Record<string, string>;
  poNumberPresent: boolean;
}

export interface ValidationError { message: string; target: string }
