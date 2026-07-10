import { auth } from "../src/lib/auth";

export default function handler(req: any, res: any) {
  res.statusCode = 200;
  res.end('static import worked ' + !!auth);
}
