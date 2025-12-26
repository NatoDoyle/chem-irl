module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include mixed Flow + TS syntax in .js files.
    // Apply both Flow and TS presets to strip all type annotations.
    // Note: setup.js uses only Flow syntax, so it's excluded (uses babel-preset-expo).
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/(mocks\/.*|mock)\.js$/,
        presets: [
          ['@babel/preset-typescript', { allExtensions: true, isTSX: false }],
          ['@babel/preset-flow', { all: true }],
        ],
      },
    ],
  };
};

