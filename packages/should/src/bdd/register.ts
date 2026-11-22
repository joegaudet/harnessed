/**
 * Import once, from your test setup file, instead of `@harnessed-ts/should/register`
 * to get Chai's full BDD vocabulary as well:
 *
 * ```ts
 * import '@harnessed-ts/should/bdd/register'
 *
 * await form.profile.should.have.property('name', 'Ada')
 * await form.attempts.should.be.within(1, 5)
 * ```
 */
import './register-scoped'
import '../globals'
