import { betterAuth } from 'better-auth';

export default function handler(req: any, res: any) {
  try {
    const auth = betterAuth({
      database: {
        dialect: { name: 'postgres' },
        create: async () => ({}),
        findOne: async () => null,
        findMany: async () => [],
        update: async () => ({}),
        delete: async () => ({}),
        deleteMany: async () => 0,
      } as any,
    });
    res.statusCode = 200;
    res.end('betterAuth instantiated successfully');
  } catch(e) {
    res.statusCode = 500;
    res.end('betterAuth instantiation failed: ' + e.message);
  }
}
