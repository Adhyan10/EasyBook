process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.GATEWAY = 'mock';
process.env.MOCK_GATEWAY_SECRET = 'test-mock-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.MONGOMS_VERSION = process.env.MONGOMS_VERSION ?? '7.0.14';
