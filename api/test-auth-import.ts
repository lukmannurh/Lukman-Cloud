import { betterAuth } from 'better-auth';
export default function handler(req: any, res: any) {
  res.statusCode = 200;
  res.end('better-auth imported ' + typeof betterAuth);
}
