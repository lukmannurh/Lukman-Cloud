import { toNodeHandler } from "better-auth/node";
export default function handler(req: any, res: any) {
  res.statusCode = 200;
  res.end('better-auth node imported ' + typeof toNodeHandler);
}
