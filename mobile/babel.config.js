module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include TS syntax in .js files.
    // Apply the TS transform to mock.js and mocks/** files so "as" casts get stripped.
    // Note: setup.js uses only Flow syntax, so it's excluded (uses babel-preset-expo).
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/(mocks\/.*|mock)\.js$/,
        presets: [
          ['@babel/preset-typescript', { allExtensions: true, isTSX: false }],
        ],
      },
    ],
  };
};

