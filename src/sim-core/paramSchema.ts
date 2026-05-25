import type { ParamSchema, ParamValues } from './types'

/** Build the default value object for a parameter schema (used to seed the param store). */
export function defaultParamValues<S extends ParamSchema>(schema: S): ParamValues<S> {
  const values: Record<string, number | boolean> = {}
  for (const key in schema) {
    values[key] = schema[key].default
  }
  return values as ParamValues<S>
}
