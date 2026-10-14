import type { CompiledRuleSet, Condition, InputVars, Rule } from "./types";

export const MAX_COMPILED_BYTES = 9500; // Functions drop metafields > 10,000 bytes
export const PLACEHOLDER_COLLECTION = "gid://shopify/Collection/0";
const MAX_ATTR_KEYS = 3;

export type CompileResult =
  | { ok: true; compiled: CompiledRuleSet; inputVars: InputVars; bytes: number }
  | { ok: false; error: string };

function uniqCI(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const k = v.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(v); }
  }
  return out;
}

export function collectInputVars(conditions: Condition[]): { ok: true; vars: InputVars } | { ok: false; error: string } {
  const tags: string[] = [], customerTags: string[] = [], attrKeys: string[] = [];
  // Distinct collection lists, each normalized (sorted, deduped) and keyed by its JSON form.
  const collectionLists = new Map<string, string[]>();
  for (const c of conditions) {
    if (c.type === "line_quantity" || c.type === "cart_has_product") {
      if (c.product.kind === "tag") tags.push(...c.product.values);
      if (c.product.kind === "collection") {
        const list = Array.from(new Set(c.product.values)).sort();
        collectionLists.set(JSON.stringify(list), list);
      }
    }
    if (c.type === "customer_tag") customerTags.push(...c.values);
    if (c.type === "cart_attribute") attrKeys.push(c.key);
  }
  const keys = Array.from(new Set(attrKeys));
  if (keys.length > MAX_ATTR_KEYS) {
    return { ok: false, error: `Rules may reference at most ${MAX_ATTR_KEYS} cart attribute keys (found ${keys.length}: ${keys.join(", ")}).` };
  }
  // The Function input can ask only one inAnyCollection(ids:) question per line, so every
  // collection condition shares that answer. Different lists would silently match each other.
  if (collectionLists.size > 1) {
    return { ok: false, error: `All collection conditions in your active rules must use the same collection list (currently ${collectionLists.size} different lists). Use product tags for finer targeting.` };
  }
  const ids = collectionLists.values().next().value ?? [];
  return {
    ok: true,
    vars: {
      tags: uniqCI(tags),
      collectionIds: ids.length ? ids : [PLACEHOLDER_COLLECTION],
      customerTags: uniqCI(customerTags),
      attr1: keys[0] ?? "", attr2: keys[1] ?? "", attr3: keys[2] ?? "",
    },
  };
}

export function compileRules(rules: Rule[]): CompileResult {
  const enabled = rules.filter((r) => r.enabled);
  const compiled: CompiledRuleSet = {
    v: 1,
    rules: enabled.map((r) => ({ c: r.combinator, k: r.conditions, m: r.message, t: r.target })),
  };
  const vars = collectInputVars(enabled.flatMap((r) => r.conditions));
  if (!vars.ok) return vars;
  const attrs = [vars.vars.attr1, vars.vars.attr2, vars.vars.attr3].filter(Boolean);
  if (attrs.length) compiled.attrs = attrs;
  const bytes = new TextEncoder().encode(JSON.stringify(compiled)).length;
  if (bytes > MAX_COMPILED_BYTES) {
    return { ok: false, error: `Your enabled rules compile to ${bytes} bytes; the limit is ${MAX_COMPILED_BYTES}. Disable a rule or shorten messages.` };
  }
  return { ok: true, compiled, inputVars: vars.vars, bytes };
}
