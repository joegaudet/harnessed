/**
 * The Standard Schema interface (https://standardschema.dev), declared here
 * rather than imported: Zod, Valibot, ArkType and the rest all implement it, and
 * depending on any one of them would be the wrong call for a test library.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1
    readonly vendor: string
    readonly validate: (value: unknown) => StandardResult<Output> | Promise<StandardResult<Output>>
    readonly types?: { readonly input: Input; readonly output: Output } | undefined
  }
}

type StandardResult<Output> =
  | { readonly value: Output; readonly issues?: undefined }
  | { readonly issues: readonly { readonly message: string; readonly path?: readonly unknown[] }[] }

/** The schema's output type, read from `types` as the Standard Schema spec defines it. */
export type InferOutput<S> = S extends { readonly '~standard': { readonly types?: infer T } }
  ? NonNullable<T> extends { readonly output: infer O }
    ? O
    : unknown
  : unknown

export function isStandardSchema(value: unknown): value is StandardSchemaV1 {
  return typeof value === 'object' && value !== null && '~standard' in value
}

/** Validates, returning the issues as readable lines, or `[]` when valid. */
export async function standardIssues(schema: StandardSchemaV1, value: unknown): Promise<string[]> {
  const result = await schema['~standard'].validate(value)
  if (result.issues === undefined) return []
  return result.issues.map(issue => {
    const path = (issue.path ?? [])
      .map(segment =>
        typeof segment === 'object' && segment !== null && 'key' in segment
          ? String((segment as { key: unknown }).key)
          : String(segment),
      )
      .join('.')
    return path === '' ? issue.message : `${path}: ${issue.message}`
  })
}
