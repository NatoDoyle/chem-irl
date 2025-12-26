module.exports = {
  preset: 'jest-expo',
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': '<rootDir>/jest.transform.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-.*|expo|expo-.*|@expo|@expo-.*|expo-modules-core)/)',
  ],
};

