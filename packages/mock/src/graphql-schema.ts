/**
 * GraphQL schema validation for mocks, from its own entry point because it needs
 * the `graphql` package — an optional peer dependency.
 *
 * ```ts
 * import { graphqlSchema } from '@harnessed-ts/mock/graphql'
 * mock(env, { validators: [graphqlSchema(sdl)] })
 * ```
 */
import { buildSchema, execute, parse, validate } from 'graphql'
import type { DocumentNode, GraphQLFieldResolver, GraphQLSchema } from 'graphql'
import type { ExchangeValidator } from './openapi'
import { bodyText } from './request'

// Reads each field by its response key, so aliased fields resolve from the
// mocked data exactly as the client will read them.
const byResponseKey: GraphQLFieldResolver<unknown, unknown> = (source, _args, _context, info) =>
  typeof source === 'object' && source !== null
    ? (source as Record<string, unknown>)[info.path.key as string]
    : undefined

/**
 * Checks each GraphQL operation the app sends against the schema, and each
 * mocked result against the operation — a field the schema lacks, a string
 * where it says `Int`, or a `null` in a non-null field all fail the test.
 */
export function graphqlSchema(sdl: string | GraphQLSchema): ExchangeValidator {
  const schema = typeof sdl === 'string' ? buildSchema(sdl) : sdl
  const documents = new Map<string, DocumentNode | Error>()
  const parsed = (query: string): DocumentNode | Error => {
    let document = documents.get(query)
    if (document === undefined) {
      try {
        document = parse(query)
      } catch (error) {
        document = error as Error
      }
      documents.set(query, document)
    }
    return document
  }

  return {
    name: 'GraphQL schema',
    validateRequest(request) {
      const operation = request.graphql
      if (operation === undefined) return []
      const document = parsed(operation.query)
      if (document instanceof Error) return [`GraphQL syntax error: ${document.message}`]
      return validate(schema, document).map(
        error => `GraphQL ${operation.operationName ?? 'operation'}: ${error.message}`,
      )
    },
    async validateReply(request, reply) {
      const operation = request.graphql
      if (operation === undefined || reply.fault !== undefined || reply.body === null) return []
      const document = parsed(operation.query)
      if (document instanceof Error) return []
      let result: { data?: unknown; errors?: unknown }
      try {
        result = JSON.parse(bodyText(reply.body))
      } catch {
        return [`GraphQL ${operation.operationName ?? 'operation'}: the mocked result is not JSON`]
      }
      if (result.data === undefined || result.data === null) return []
      const executed = await execute({
        schema,
        document,
        rootValue: result.data,
        variableValues: operation.variables,
        ...(operation.operationName === undefined
          ? {}
          : { operationName: operation.operationName }),
        fieldResolver: byResponseKey,
      })
      return (executed.errors ?? []).map(
        error =>
          `GraphQL ${operation.operationName ?? 'operation'} result${
            error.path === undefined ? '' : ` at ${error.path.join('.')}`
          }: ${error.message}`,
      )
    },
  }
}
