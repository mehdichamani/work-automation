jest.mock('archiver', () => {
  return function() {
    return {
      pipe: jest.fn().mockReturnThis(),
      append: jest.fn().mockReturnThis(),
      finalize: jest.fn().mockReturnThis(),
    };
  };
});

const mockPrisma = require('./prismaMock').createMockPrisma();
jest.mock('../database/prisma', () => mockPrisma);

const { createTestApp, generateToken } = require('./testApp');

module.exports = { createTestApp, generateToken };
