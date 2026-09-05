/**
 * The runtime object a harness is handed, tagged with the driver that understands
 * it. Carries no methods: it is inert data, and the driver does all the work.
 *
 * Drivers widen it — `@harnessed/dom` adds `user` and `container`,
 * `@harnessed/playwright` adds `page`.
 */
export interface EnvConfig {
  /** Driver id, matched against the driver registry. */
  readonly driver: string
}
