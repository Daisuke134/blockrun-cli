// REQ-DX-005. Pure rendering for `blockrun commands` — the catalog itself is built by
// src/core/commands-catalog.ts (needs live access to the Commander `program` object,
// so it is invoked directly from src/index.ts rather than through the generic
// RunFn/dispatch() pattern every other command uses). Lives in src/core/, not
// src/commands/ — it is not one of the 18 REAL, gatePaidCall-eligible commands that
// PROP-DX-007/014's per-file invariants (exactly 18 files in src/commands/, all
// routing through extractErrorMessage()) enumerate.
import { ok } from "./render.js";
import type { CommandOutcome } from "./render.js";
import type { CommandCatalogEntry } from "./commands-catalog.js";

function padEnd(s: string, len: number): string {
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

export function renderCommandsOutcome(catalog: CommandCatalogEntry[], json: boolean): CommandOutcome {
  if (json) {
    return ok({ commands: catalog }, true, "");
  }
  const nameWidth = Math.max(...catalog.map((c) => c.name.length), "command".length);
  const costWidth = 4; // "Free" / "Paid"
  const header = `${padEnd("command", nameWidth)}  ${padEnd("cost", costWidth)}  description`;
  const rows = catalog.map((c) =>
    `${padEnd(c.name, nameWidth)}  ${padEnd(c.costModel === "paid" ? "Paid" : "Free", costWidth)}  ${c.description}`,
  );
  return ok({ commands: catalog }, false, [header, ...rows].join("\n"));
}
