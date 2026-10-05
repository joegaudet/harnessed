import { config as bidi } from './wdio.conf'

/**
 * The same run over WebDriver Classic. The driver enters frames differently
 * there — by switching the session rather than through a frame's own browsing
 * context — so both protocols are run, not just WebdriverIO's default.
 */
export const config: WebdriverIO.Config = {
  ...bidi,
  capabilities: bidi.capabilities.map(capabilities => ({
    ...capabilities,
    'wdio:enforceWebDriverClassic': true,
  })),
}
