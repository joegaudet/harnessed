/**
 * `@harnessed-ts/should/bdd/register` without its global types, for a suite
 * that also uses Chai's should interface. See `@harnessed-ts/should/register-scoped`.
 */
import '../register-scoped'
import { addValueChecks } from '../chain'
import { bddAssertions } from './assertions'
import './types'

addValueChecks(bddAssertions)
