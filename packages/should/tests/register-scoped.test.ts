import { afterEach, describe, it } from 'vitest'
import '../src/bdd/register-scoped'
import { FULL_FORM, show } from './helpers'

afterEach(() => {
  document.body.innerHTML = ''
})

/**
 * The scoped registers install everything at runtime but declare no global
 * `Promise.should` or `Function.should`, which would hide the types of Chai's
 * own should interface on promises and functions.
 */
describe('register-scoped', () => {
  it('installs should on harness methods, their calls and the BDD vocabulary', async () => {
    const form = show(FULL_FORM)
    await Reflect.get(form.error, 'should').match(/credentials/)
    await Reflect.get(form.attempts(), 'should').be.within(1, 5)
    await form.should.not.be.absent()
  })
})
