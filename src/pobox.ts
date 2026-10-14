const PATTERNS: RegExp[] = [
  /\bp\.?\s*o\.?\s*box\b/i,          // PO Box, P.O. Box, p o box
  /\bpost\s*office\s*box\b/i,        // Post Office Box
  /\bpob\b\s*\d*/i,                  // POB 12
  /^\s*box\s*\d+[a-z]?\b/i,          // "Box 221B" at start of a line
];

export function isPoBox(address1: string | null, address2: string | null): boolean {
  for (const line of [address1, address2]) {
    if (!line) continue;
    if (PATTERNS.some((re) => re.test(line))) return true;
  }
  return false;
}
