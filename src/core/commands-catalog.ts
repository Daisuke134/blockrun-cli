// REQ-DX-001..008, REQ-DX-NG-004. Builds the `blockrun commands` catalog FRESH on
// every invocation (REQ-DX-007) by introspecting the ALREADY-LOADED zod `schema`
// exports and reading the ALREADY-REGISTERED Commander `.description(...)` strings at
// runtime — never a build-time-generated static file. `description` comes from the
// LIVE Commander `Command` object itself (the exact text `blockrun <name> --help`
// shows), not a second, independently-typed copy.
import type { Command } from "commander";
import { introspectSchema, type FlagMeta, type IntrospectableSchema } from "./introspect-schema.js";
import { COMMAND_COST_MODEL, type CostModel } from "./cost-model.js";

import { schema as walletSchema } from "../args/wallet.js";
import { schema as chatSchema } from "../args/chat.js";
import { schema as modelsSchema } from "../args/models.js";
import { schema as imageSchema } from "../args/image.js";
import { schema as videoSchema } from "../args/video.js";
import { schema as realfaceSchema } from "../args/realface.js";
import { schema as musicSchema } from "../args/music.js";
import { schema as speechSchema } from "../args/speech.js";
import { schema as searchSchema } from "../args/search.js";
import { schema as exaSchema } from "../args/exa.js";
import { schema as marketsSchema } from "../args/markets.js";
import { schema as priceSchema } from "../args/price.js";
import { schema as dexSchema } from "../args/dex.js";
import { schema as rpcSchema } from "../args/rpc.js";
import { schema as defiSchema } from "../args/defi.js";
import { schema as modalSchema } from "../args/modal.js";
import { schema as phoneSchema } from "../args/phone.js";
import { schema as surfSchema } from "../args/surf.js";

const SCHEMAS: Record<string, IntrospectableSchema> = {
  wallet: walletSchema,
  chat: chatSchema,
  models: modelsSchema,
  image: imageSchema,
  video: videoSchema,
  realface: realfaceSchema,
  music: musicSchema,
  speech: speechSchema,
  search: searchSchema,
  exa: exaSchema,
  markets: marketsSchema,
  price: priceSchema,
  dex: dexSchema,
  rpc: rpcSchema,
  defi: defiSchema,
  modal: modalSchema,
  phone: phoneSchema,
  surf: surfSchema,
};

export interface CommandCatalogEntry {
  name: string;
  description: string;
  costModel: CostModel;
  flags: FlagMeta[];
}

/** REQ-DX-002: exactly the 18 EXISTING subcommands, self-excluding `commands`. */
export function buildCommandsCatalog(program: Command): CommandCatalogEntry[] {
  return program.commands
    .filter((cmd) => cmd.name() !== "commands")
    .map((cmd) => {
      const name = cmd.name();
      const schema = SCHEMAS[name];
      return {
        name,
        description: cmd.description(),
        costModel: COMMAND_COST_MODEL[name] ?? "paid",
        flags: schema ? introspectSchema(schema) : [],
      };
    });
}
