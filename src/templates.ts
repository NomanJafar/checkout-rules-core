import type { Rule } from "./types";

export interface RuleTemplate { key: string; title: string; description: string; rule: Omit<Rule, "id"> }

export const TEMPLATES: RuleTemplate[] = [
  { key: "max_qty_per_product", title: "Maximum quantity per product variant", description: "Stop bulk buyers and bots from clearing your stock (limit applies to each variant/cart line).",
    rule: { name: "Max 5 per product variant", enabled: true, combinator: "and", conditions: [{ type: "line_quantity", op: "gt", value: 5, product: { kind: "any" } }], message: "You can order at most 5 units of each product variant.", target: "$.cart" } },
  { key: "min_order_value", title: "Minimum order value", description: "Require a minimum subtotal before checkout.",
    rule: { name: "Minimum order $25", enabled: true, combinator: "and", conditions: [{ type: "cart_subtotal", op: "lt", value: 25 }], message: "Orders must be at least $25.", target: "$.cart" } },
  { key: "block_po_box", title: "Block PO box addresses", description: "Carriers like UPS and FedEx can't deliver to PO boxes.",
    rule: { name: "No PO boxes", enabled: true, combinator: "and", conditions: [{ type: "shipping_po_box", value: true }], message: "We cannot ship to PO boxes. Please enter a street address.", target: "$.cart.deliveryGroups[0].deliveryAddress.address1" } },
  { key: "wholesale_only", title: "Wholesale-only products", description: "Only customers tagged 'wholesale' can buy products tagged 'wholesale'.",
    rule: { name: "Wholesale products for wholesale customers", enabled: true, combinator: "and", conditions: [{ type: "cart_has_product", op: "is", product: { kind: "tag", values: ["wholesale"] } }, { type: "customer_tag", op: "is_not", values: ["wholesale"] }], message: "Wholesale products are only available to approved wholesale accounts. Please log in or apply for an account.", target: "$.cart" } },
  { key: "restrict_countries", title: "Restrict products to countries", description: "Block products tagged 'us-only' from shipping outside the US.",
    rule: { name: "US-only products", enabled: true, combinator: "and", conditions: [{ type: "cart_has_product", op: "is", product: { kind: "tag", values: ["us-only"] } }, { type: "shipping_country", op: "is_not", values: ["US"] }], message: "Some items in your cart can only be shipped within the United States.", target: "$.cart.deliveryGroups[0].deliveryAddress.countryCode" } },
  { key: "require_po_number_b2b", title: "Require PO number for B2B", description: "Company customers must enter a purchase order number.",
    rule: { name: "PO number required for B2B", enabled: true, combinator: "and", conditions: [{ type: "customer_is_b2b", value: true }, { type: "po_number_present", value: false }], message: "Please enter your purchase order number to complete this order.", target: "$.cart" } },
  { key: "limit_sale_collection", title: "Limit units from a sale collection", description: "Cap how many units of each product variant tagged 'sale' one order line can contain.",
    rule: { name: "Max 2 per sale product variant", enabled: true, combinator: "and", conditions: [{ type: "line_quantity", op: "gt", value: 2, product: { kind: "tag", values: ["sale"] } }], message: "Sale items are limited to 2 per order line.", target: "$.cart" } },
];

export function templateByKey(key: string): RuleTemplate | undefined {
  return TEMPLATES.find((t) => t.key === key);
}
