import { cleanup } from '@testing-library/react'
import { afterEach } from 'bun:test'

// Testing Library only registers its own cleanup when it finds a global
// `afterEach`, which bun:test does not provide. A preload's hooks apply to every
// test file. It matters more than usual: a leaked previous tree makes strict
// single-target queries ambiguous.
afterEach(cleanup)
