import { bootstrapApplication } from '@angular/platform-browser'
import { appConfig } from './app/app.config'
import { ConformanceApp } from './app/fixture/conformance-app'

bootstrapApplication(ConformanceApp, appConfig).catch((error: unknown) => console.error(error))
