// bunfig.toml preloads the matchers at runtime; this brings their types into
// the test files, which never import the entry themselves.
import '@harnessed-ts/dom/matchers/bun'
