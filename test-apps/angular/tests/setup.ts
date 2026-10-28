// The JIT compiler, for the libraries only: Angular's own packages and
// @testing-library/angular ship partially compiled, and Vitest loads them
// without the linker a build runs. This app's components are compiled ahead of
// time by the Angular plugin.
import '@angular/compiler'
import { getTestBed } from '@angular/core/testing'
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing'
import { afterEach } from 'vitest'

// TestBed is zoneless by default, and zone.js is never loaded.
getTestBed().initTestEnvironment(BrowserTestingModule, platformBrowserTesting())

// TestBed registers this itself only where `afterEach` is a global, and Vitest's
// globals are off. Resetting destroys the test's fixtures, which removes their
// nodes — portalled ones included. A leaked tree would make strict
// single-target queries ambiguous in the next test.
afterEach(() => {
  getTestBed().resetTestingModule()
})
