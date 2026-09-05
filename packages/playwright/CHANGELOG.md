# @harnessed/playwright

## 0.1.0

First release.

Playwright driver, plus two things this setup earned: `createApiStubs`, for running
a browser suite with no backend, and `withWorld`, a scenario-scoped bag so BDD
steps stop sharing module-level state that breaks when a worker is reused.
