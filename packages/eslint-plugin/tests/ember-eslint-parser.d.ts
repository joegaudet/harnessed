// ember-eslint-parser ships no types; RuleTester needs only its parser shape.
declare module 'ember-eslint-parser' {
  import type { Linter } from 'eslint'

  const parser: Linter.Parser
  export default parser
}
