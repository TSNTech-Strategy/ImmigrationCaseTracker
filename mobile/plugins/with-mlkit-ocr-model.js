// Asks Google Play to download ML Kit's text-recognition model when the app is
// installed, so the first receipt scan on Android doesn't wait for (or fail on)
// the download. https://developers.google.com/ml-kit/vision/text-recognition/v2/android
const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

module.exports = function withMlkitOcrModel(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(app, "com.google.mlkit.vision.DEPENDENCIES", "ocr");
    return cfg;
  });
};
