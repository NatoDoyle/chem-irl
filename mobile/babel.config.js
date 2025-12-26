module.exports = function (api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],

    // React Native's Jest mocks include mixed Flow + TS syntax in .js files.
    // babel-preset-expo already handles Flow, but we need TS plugin to strip "as" casts.
    // Note: setup.js uses only Flow syntax, so it's excluded (uses babel-preset-expo).
    overrides: [
      {
        test: /node_modules\/react-native\/jest\/(mocks\/.*|mock)\.js$/,
        presets: ['babel-preset-expo'],
        plugins: ['@babel/plugin-transform-typescript'],
      },
    ],
  };
};

