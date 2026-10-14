import type { CartSnapshot, CompiledRuleSet, Condition, NumberCmp, ProductFilter, ValidationError } from "./types";
import { isPoBox } from "./pobox";

function cmp(n: number, c: NumberCmp): boolean {
  switch (c.op) {
    case "lt": return n < c.value;
    case "gt": return n > c.value;
    case "eq": return n === c.value;
    case "between": return n >= c.value && n <= (c.value2 ?? c.value);
  }
}

function inSet(v: string | null, op: "is" | "is_not", values: string[]): boolean {
  if (v === null) return false;
  const hit = values.some((x) => x.toLowerCase() === v.toLowerCase());
  return op === "is" ? hit : !hit;
}

function anyOverlap(have: string[], want: string[]): boolean {
  const lower = new Set(have.map((t) => t.toLowerCase()));
  return want.some((w) => lower.has(w.toLowerCase()));
}

function text(v: string | null, op: "is" | "is_not" | "contains" | "matches", value: string): boolean {
  if (v === null) return false;
  const a = v.toLowerCase(), b = value.toLowerCase();
  switch (op) {
    case "is": return a === b;
    case "is_not": return a !== b;
    case "contains": return a.includes(b);
    case "matches":
      try { return new RegExp(value, "i").test(v); } catch { return false; }
  }
}

function lineMatches(line: CartSnapshot["lines"][number], f: ProductFilter): boolean {
  switch (f.kind) {
    case "any": return true;
    case "tag": return anyOverlap(line.productTags, f.values);
    case "collection": return line.inAnyCollection;
    case "sku": return line.sku !== null && f.values.some((s) => s.toLowerCase() === line.sku!.toLowerCase());
    case "variant": return f.values.includes(line.variantId);
  }
}

export function evaluateCondition(c: Condition, cart: CartSnapshot): boolean {
  switch (c.type) {
    case "cart_subtotal": return cmp(cart.subtotal, c);
    case "cart_item_count": return cmp(cart.itemCount, c);
    case "line_quantity": return cart.lines.some((l) => lineMatches(l, c.product) && cmp(l.quantity, c));
    case "cart_has_product": {
      const has = cart.lines.some((l) => lineMatches(l, c.product));
      return c.op === "is" ? has : !has;
    }
    case "customer_tag": {
      const hit = anyOverlap(cart.customer.tags, c.values);
      return c.op === "is" ? hit : !hit;
    }
    case "customer_logged_in": return cart.customer.loggedIn === c.value;
    case "customer_order_count": return cmp(cart.customer.orderCount, c);
    case "customer_is_b2b": return cart.customer.isB2B === c.value;
    case "shipping_country": return inSet(cart.shipping?.country ?? null, c.op, c.values);
    case "shipping_province": return inSet(cart.shipping?.province ?? null, c.op, c.values);
    case "shipping_zip": return text(cart.shipping?.zip ?? null, c.op, c.value);
    case "shipping_po_box":
      if (!cart.shipping) return false;
      return isPoBox(cart.shipping.address1, cart.shipping.address2) === c.value;
    case "shipping_address_length": {
      if (!cart.shipping) return false;
      const len = (cart.shipping.address1 ?? "").length + (cart.shipping.address2 ?? "").length;
      return cmp(len, c);
    }
    case "cart_attribute": {
      const v = cart.attributes[c.key];
      if (c.op === "present") return v !== undefined;
      if (c.op === "absent") return v === undefined;
      return v !== undefined && v === (c.value ?? "");
    }
    case "po_number_present": return cart.poNumberPresent === c.value;
  }
}

export function evaluateRules(set: CompiledRuleSet, cart: CartSnapshot): ValidationError[] {
  // Validate only at checkout. During CART_INTERACTION (add-to-cart, cart page) an error would
  // block the cart action itself, e.g. a PO-box rule stopping a customer from adding a product.
  if (cart.step === "CART_INTERACTION") return [];
  const errors: ValidationError[] = [];
  for (const r of set.rules) {
    if (r.k.length === 0) continue; // an empty rule must never match ([].every() is true)
    const results = r.k.map((k) => evaluateCondition(k, cart));
    const hit = r.c === "and" ? results.every(Boolean) : results.some(Boolean);
    if (hit) errors.push({ message: r.m, target: r.t });
  }
  return errors;
}
