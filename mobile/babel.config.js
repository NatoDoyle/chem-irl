module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          // Explicitly enable all syntax features including Flow
          jsxRuntime: 'automatic',
        },
      ],
    ],
    plugins: ['@babel/plugin-transform-flow-strip-types'],
  };
};

