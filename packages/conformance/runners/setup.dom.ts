import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Globals are off, so cleanup is registered by hand. It matters more here than
// usual: a leaked previous tree makes strict single-target queries ambiguous.
afterEach(cleanup)
