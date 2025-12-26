module.exports = {
  preset: 'jest-expo',

  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/jest.transform.js',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|react-native|@react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo/.*|@react-navigation/.*|react-navigation|@sentry/react-native|react-native-svg|react-native-reanimated|react-native-gesture-handler)',
  ],
};

