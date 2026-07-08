// REQ-DX-004, REQ-DX-NG-004. Runtime introspection of a zod 4.4.3 `schema` export
// (never a hand-maintained duplicate) — the exact API surface confirmed live in this
// repo's Node REPL before writing the spec: `.isOptional()`, unwrapped `_def.type`
// after peeling `ZodDefault`/`ZodOptional`, `ZodEnum.options`, `ZodDefault._def
// .defaultValue` (a direct value, never a function, for every default actually used
// across the 18 command schemas).
export type FlagType = "string" | "number" | "boolean" | "enum" | "array" | "object" | "any";

export interface FlagMeta {
  flag: string;
  type: FlagType;
  required: boolean;
  enum?: string[];
  default?: unknown;
}

export interface IntrospectableSchema {
  shape: Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodFieldLike = any;

/** REQ-DX-004 flag naming: kebab-case of the zod field's snake_case name (base CLI's
 *  own REQ-004a convention, reused verbatim). */
function toFlagName(fieldName: string): string {
  return `--${fieldName.replace(/_/g, "-")}`;
}

export function introspectSchema(schema: IntrospectableSchema): FlagMeta[] {
  return Object.entries(schema.shape).map(([fieldName, fieldRaw]) => {
    const field = fieldRaw as ZodFieldLike;
    const required = !field.isOptional();

    let node = field;
    let defaultValue: unknown;
    let hasDefault = false;
    if (node._def?.type === "default") {
      hasDefault = true;
      defaultValue = node._def.defaultValue;
      node = node._def.innerType;
    }
    if (node._def?.type === "optional") {
      node = node._def.innerType;
    }

    let type: FlagType;
    let enumValues: string[] | undefined;
    switch (node._def?.type) {
      case "enum":
        type = "enum";
        enumValues = node.options;
        break;
      case "string":
        type = "string";
        break;
      case "number":
        type = "number";
        break;
      case "boolean":
        type = "boolean";
        break;
      case "array":
        type = "array";
        break;
      case "object":
        type = "object";
        break;
      default:
        type = "any";
    }

    const entry: FlagMeta = { flag: toFlagName(fieldName), type, required };
    if (enumValues) entry.enum = enumValues;
    if (hasDefault) entry.default = defaultValue;
    return entry;
  });
}
