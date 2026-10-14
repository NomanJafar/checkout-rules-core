# checkout-rules-core

[![test](https://github.com/NomanJafar/checkout-rules-core/actions/workflows/test.yml/badge.svg)](https://github.com/NomanJafar/checkout-rules-core/actions/workflows/test.yml)

The rules engine behind [Checkout Guard](https://provemvp.com/work/checkout-guard), a Shopify app that blocks bad orders at checkout without code. Merchants describe rules like "no PO boxes" or "wholesale products for wholesale customers only"; this package validates them, compiles them into something a Shopify Function can run, and evaluates them against a cart.

One TypeScript engine is shared by the admin app (rule editor and "test against a sample cart" preview) and by the Shopify Function that runs inside checkout, so what the merchant previews is exactly what checkout enforces.

## What's in it

| Module | Does |
|---|---|
| `schema.ts` | Zod schemas for rules and conditions: everything the editor saves is validated here |
| `compile.ts` | Turns enabled rules into a compact `CompiledRuleSet` and the input-query variables the Function needs. Rejects rule sets over 9,500 bytes, because Shopify Functions can't read metafields over 10 kB and can't make network calls |
| `normalize.ts` | Maps the Shopify Function input into a platform-independent `CartSnapshot` |
| `evaluate.ts` | Evaluates rules (`and` / `or`) against a `CartSnapshot` and returns checkout errors with their target field |
| `pobox.ts` | PO box detection for address lines |
| `templates.ts` | Seven one-click rule templates (quantity limits, minimum order, PO boxes, wholesale-only, country restrictions, B2B PO number, sale limits) |

Conditions cover cart subtotal and item count, per-line quantity by product/tag/collection/SKU/variant, customer tags, login state, order count and B2B status, shipping country/province/ZIP, PO boxes, address length, cart attributes, and PO numbers.

## Example

```ts
import { compileRules, evaluateRules, templateByKey, type CartSnapshot } from "checkout-rules-core";

const noPoBox = templateByKey("block_po_box")!;
const result = compileRules([{ id: "r1", ...noPoBox.rule }]);
if (!result.ok) throw new Error(result.error);

const cart: CartSnapshot = {
  step: "CHECKOUT_INTERACTION",
  subtotal: 80,
  itemCount: 2,
  lines: [{ quantity: 2, variantId: "gid://shopify/ProductVariant/1", sku: "TEE-M", productTags: [], inAnyCollection: false }],
  customer: { loggedIn: true, tags: [], orderCount: 3, isB2B: false },
  shipping: { country: "US", province: "TX", zip: "73301", address1: "PO Box 112", address2: null },
  attributes: {},
  poNumberPresent: false,
};

console.log(evaluateRules(result.compiled, cart));
// [{ message: "We cannot ship to PO boxes. Please enter a street address.",
//    target: "$.cart.deliveryGroups[0].deliveryAddress.address1" }]
```

## Development

```bash
npm install
npm test          # 47 Vitest tests
npm run build     # strict TypeScript type-check
```

## Design notes

- **Short keys on purpose.** The compiled set uses `c`/`k`/`m`/`t` instead of `combinator`/`conditions`/`message`/`target` so more rules fit under the metafield limit.
- **Collections are one question per line.** The Function input asks a single `inAnyCollection` question per cart line, so all collection conditions in an active rule set must share one collection list; `compileRules` rejects sets that don't. Use product tags for finer targeting.
- **Fail open.** The engine only reports errors for rules that match; the app's Function lets checkout through if anything is missing, so a misconfiguration never blocks a store's sales.

## License

MIT © Noman Jafar · Built at [ProveMVP](https://provemvp.com)
