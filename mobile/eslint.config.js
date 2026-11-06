// Expo's recommended lint rules for the app (https://docs.expo.dev/guides/using-eslint/).
// The website has its own config at the repository root, which skips this folder.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([expoConfig, { ignores: ["dist/*", ".expo/*"] }]);
