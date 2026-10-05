import { harnessedChai } from '@harnessed-ts/chai'
import '@harnessed-ts/cypress/support'

// Cypress bundles Chai; this adds `absent`, `selected` and `readAs` to its expect.
chai.use(harnessedChai)
