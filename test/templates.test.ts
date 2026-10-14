import { describe, it, expect } from "vitest";
import { TEMPLATES, templateByKey } from "../src/templates";
import { RuleSchema } from "../src/schema";
import { compileRules } from "../src/compile";

describe("templates", () => {
  it("ships exactly the 7 spec templates, all valid", () => {
    expect(TEMPLATES.map((t) => t.key)).toEqual([
      "max_qty_per_product", "min_order_value", "block_po_box", "wholesale_only",
      "restrict_countries", "require_po_number_b2b", "limit_sale_collection",
    ]);
    for (const t of TEMPLATES) expect(RuleSchema.safeParse({ id: "x", ...t.rule }).success).toBe(true);
  });
  it("all templates enabled together fit the size budget", () => {
    const res = compileRules(TEMPLATES.map((t, i) => ({ id: String(i), ...t.rule })));
    expect(res.ok).toBe(true);
  });
  it("looks up by key", () => {
    expect(templateByKey("block_po_box")?.title).toBe("Block PO box addresses");
    expect(templateByKey("nope")).toBeUndefined();
  });
  it("targets the whole cart for the B2B PO-number template (always a valid target)", () => {
    expect(templateByKey("require_po_number_b2b")?.rule.target).toBe("$.cart");
  });
  it("describes per-line limits accurately", () => {
    expect(templateByKey("max_qty_per_product")?.title).toBe("Maximum quantity per product variant");
    expect(templateByKey("limit_sale_collection")?.rule.message).toBe("Sale items are limited to 2 per order line.");
  });
});
