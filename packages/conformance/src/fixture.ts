/**
 * The app the specs drive: a login form, a card grid, a portalled dialog, and a
 * two-step wizard. Small on purpose — every element in it exists to exercise a
 * named guarantee.
 *
 * Serve it (the Playwright reference runner points Vite at it) or render it
 * directly (the jsdom one does). React is an optional peer; you only need it if
 * you use this fixture rather than porting it.
 */
export { App, CARDS } from '../fixture/App'
export { Card, CardGrid } from '../fixture/components/CardGrid'
export type { CardProps, CardSpec } from '../fixture/components/CardGrid'
export { LoginForm } from '../fixture/components/LoginForm'
export type { LoginFormProps, LoginStatus } from '../fixture/components/LoginForm'
export { PortalDialog } from '../fixture/components/PortalDialog'
export { StepOne, StepTwo } from '../fixture/components/Wizard'
