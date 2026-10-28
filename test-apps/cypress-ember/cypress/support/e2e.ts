import { harnessedChai } from '@harnessed-ts/chai'
import '@harnessed-ts/cypress/support'
// The catch-all intercept mocks go through, and a reset after every test.
import '@harnessed-ts/cypress/mock'

// Cypress bundles Chai; this adds `absent`, `selected` and `readAs` to its expect.
chai.use(harnessedChai)
