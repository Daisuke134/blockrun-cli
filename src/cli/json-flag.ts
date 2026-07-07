// REQ-004 (decisions.md §4). Normalizes the `--param-json '<json>'` and
// `--param @file.json` forms into one already-decoded value.
import { readFileSync } from "node:fs";

export function parseJsonInput(raw: string): unknown {
  const source = raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw;
  return JSON.parse(source);
}
