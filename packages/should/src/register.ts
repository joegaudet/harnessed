/**
 * Import once, from your test setup file, to give every harness and query a
 * `should`:
 *
 * ```ts
 * import '@harnessed-ts/should/register'
 *
 * await form.error.should.be.null()
 * await form.cell(2, 'name').should.equal('2:name')
 * await form.should.be.absent()
 * ```
 *
 * Using Chai's should interface too? Import `@harnessed-ts/should/register-scoped`
 * instead, which leaves out the global types that would hide Chai's.
 */
import './register-scoped'
import './globals'
