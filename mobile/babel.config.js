module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include TS syntax in .js files.
    // Apply the TS transform only to those files so "as" casts get stripped.
    // Note: setup.js uses Flow syntax, so we only target mocks/ directory.
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/mocks\/.*\.js$/,
        presets: [
          ['@babel/preset-typescript', { allExtensions: true, isTSX: false }],
        ],
      },
    ],
  };
};

