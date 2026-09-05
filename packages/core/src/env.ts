/**
 * The runtime object a harness is handed, tagged with the driver that understands
 * it. Carries no methods: it is inert data, and the driver does all the work.
 *
 * Drivers widen it — `@harnessed-ts/dom` adds `user` and `container`,
 * `@harnessed-ts/playwright` adds `page`.
 */
export interface EnvConfig {
  /** Driver id, matched against the driver registry. */
  readonly driver: string
}
