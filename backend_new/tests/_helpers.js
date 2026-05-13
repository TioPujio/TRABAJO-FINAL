import { jest } from "@jest/globals";

export async function createAppWithPrisma(prismaMock) {
  jest.resetModules();
  jest.unstable_mockModule("../src/prisma.js", () => ({ default: prismaMock }));
  const { default: app } = await import("../src/app.js");
  return app;
}

export function makePrismaMock(overrides = {}) {
  return {
    product: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      ...(overrides.product || {})
    },
    order: {
      findUnique: jest.fn(),
      create: jest.fn(),
      ...(overrides.order || {})
    },
    orderItem: {
      createMany: jest.fn(),
      ...(overrides.orderItem || {})
    },
    $transaction: jest.fn(),
    ...(overrides.root || {})
  };
}

