import { provideZonelessChangeDetection } from '@angular/core'
import type { ApplicationConfig } from '@angular/core'
import { provideRouter } from '@angular/router'
import { FIXTURE_ROUTES } from './fixture/conformance-app'

/** The app as served: zoneless, with the router owning the URL. */
export const appConfig: ApplicationConfig = {
  providers: [provideZonelessChangeDetection(), provideRouter(FIXTURE_ROUTES)],
}
