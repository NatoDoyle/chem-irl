module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include TS syntax in .js files.
    // Apply the TS transform only to those files so "as" casts get stripped.
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/.*\.js$/,
        presets: [
          ['@babel/preset-typescript', { allExtensions: true, isTSX: false }],
        ],
      },
    ],
  };
};

