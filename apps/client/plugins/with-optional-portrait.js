/**
 * The app runs in portrait, which makes Android list "a portrait screen" as a
 * required hardware feature. Google Play then hides the app from devices it
 * thinks lack one (some tablets, Chromebooks, PCs). Mark it as not required:
 * the app still opens in portrait wherever it can.
 */
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] ?? []).filter(
      (f) => f.$?.['android:name'] !== 'android.hardware.screen.portrait',
    );
    manifest['uses-feature'].push({
      $: { 'android:name': 'android.hardware.screen.portrait', 'android:required': 'false' },
    });
    return cfg;
  });
};
