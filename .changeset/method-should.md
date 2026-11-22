---
'@harnessed-ts/should': minor
'@harnessed-ts/core': minor
'@harnessed-ts/storybook': patch
---

`should` now follows the member it asserts on: `await form.error.should.be.null()`,
and `await form.cell(2, 'name').should.equal('2:name')` for a method with arguments.
`form.error().should` is typed by the method; `form.error.should` accepts any expected
value. **Breaking:** `form.should.<member>` is gone; `form.should` asserts only on the
harness's own host (`form.should.be.absent()`). Suites that also use Chai's should
interface import `/register-scoped` (or `/bdd/register-scoped`), which leaves out the
global `Function.should` and `Promise.should` types that would hide Chai's. Core adds `registerHarnessWrapper`,
which `@harnessed-ts/should/register` uses to wrap each harness. Storybook's step
labels keep masking secrets, and keep `should`, when should is registered.
