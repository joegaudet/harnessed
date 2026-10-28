// The catalog under Nightwatch's own test runner, in Chrome or Firefox
// (`--env chrome`, `--env firefox`). nightwatch.mocha.conf.cjs runs the same
// specs under Nightwatch's Mocha runner.
//
// Drivers: with no server_path, selenium-webdriver's Selenium Manager (which
// Nightwatch depends on) finds the installed browser and fetches the matching
// chromedriver or geckodriver when the session starts — as WebdriverIO does
// for its own run. CHROME_BIN / CHROMEDRIVER_PATH and FIREFOX_BIN /
// GECKODRIVER_PATH override either side, for a local browser or a driver
// already on the machine; unset, they change nothing.

/** This runner's own fixture port, so it can run beside the other drivers' runners. */
const FIXTURE_PORT = 5195

const env = name => process.env[name] || undefined

module.exports = {
  src_folders: ['specs'],
  // Every spec in the file runs, whatever failed before it: one failing
  // guarantee must not hide the next.
  skip_testcases_on_fail: false,
  output_folder: false,
  usage_analytics: { enabled: false },
  // Specs are TypeScript, which Node runs by stripping the types. Nightwatch
  // would load ts-node only for a nightwatch/tsconfig.json or
  // tsconfig.nightwatch.json, and there is neither.

  test_settings: {
    default: {
      launch_url: `http://localhost:${FIXTURE_PORT}`,
      globals: {
        // Readiness and timeout specs wait on purpose; a hook gets their budget too.
        asyncHookTimeout: 60_000,
      },
    },

    chrome: {
      desiredCapabilities: {
        browserName: 'chrome',
        'goog:chromeOptions': {
          args: ['--headless=new', '--window-size=1280,800'],
          ...(env('CHROME_BIN') ? { binary: env('CHROME_BIN') } : {}),
        },
      },
      webdriver: { start_process: true, server_path: env('CHROMEDRIVER_PATH') },
    },

    firefox: {
      desiredCapabilities: {
        browserName: 'firefox',
        'moz:firefoxOptions': {
          args: ['-headless'],
          ...(env('FIREFOX_BIN') ? { binary: env('FIREFOX_BIN') } : {}),
        },
      },
      webdriver: { start_process: true, server_path: env('GECKODRIVER_PATH') },
    },
  },
}
