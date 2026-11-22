/**
 * Import once, from your test setup file, instead of `@harnessed-ts/should/register`
 * to get Chai's full BDD vocabulary as well:
 *
 * ```ts
 * import '@harnessed-ts/should/bdd/register'
 *
 * await form.should.profile.have.property('name', 'Ada')
 * await form.should.attempts.be.within(1, 5)
 * ```
 */
import '../register'
import { addValueChecks } from '../chain'
import { bddAssertions } from './assertions'
import './types'

addValueChecks(bddAssertions)
