const generate = require('videojs-generate-karma-config');

module.exports = function(config) {

  // see https://github.com/videojs/videojs-generate-karma-config
  // for options
  const options = {
    // Safari can't run headless and requires AppleScript automation
    // permissions, which hangs local runs. Use the other detected browsers.
    browsers: (aboutToRun) => aboutToRun.filter((b) => b !== 'Safari'),

    // GitHub's Ubuntu runners restrict the user namespaces Chrome's sandbox
    // relies on, so CI runs Chrome without it.
    ciLaunchers: (defaults) => Object.assign(defaults, {
      ChromeHeadlessCI: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox']
      },
      FirefoxHeadlessCI: {
        base: 'FirefoxHeadless'
      }
    })
  };

  config = generate(config, options);

  // any other custom stuff not supported by options here!
};
