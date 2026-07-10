import { testString } from "../src/lib/test-dep";

export default function handler(req: any, res: any) {
  res.statusCode = 200;
  res.end('Test module loaded: ' + testString);
}
