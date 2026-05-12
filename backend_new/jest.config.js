export default {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js", "**/?(*.)+(spec|test).js"],
  roots: ["<rootDir>/tests"],
  collectCoverageFrom: ["src/**/*.js", "!src/routes/chat.js"],
  coverageDirectory: "coverage",
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 50,
      functions: 75,
      lines: 80
    }
  }
};
