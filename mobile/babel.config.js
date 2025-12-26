module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include mixed Flow + TS syntax in .js files.
    // We need to preprocess to strip TS "as" casts before Flow parser runs.
    // Note: setup.js uses only Flow syntax, so it's excluded (uses babel-preset-expo).
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/(mocks\/.*|mock)\.js$/,
        presets: ['babel-preset-expo'],
        plugins: [
          // Custom plugin to strip TypeScript "as" casts while keeping Flow parser
          function () {
            return {
              name: 'strip-ts-as-casts',
              parserOverride(code) {
                // Strip TS "as Type" casts before parsing (Flow parser handles the rest)
                return code.replace(/\s+as\s+[A-Za-z0-9_$]+(?:\.[A-Za-z0-9_$]+)*(?:<[^>]*>)?/g, '');
              },
            };
          },
        ],
      },
    ],
  };
};

