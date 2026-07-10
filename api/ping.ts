export default function pingHandler(req: any, res: any) {
  res.statusCode = 200;
  res.end('pong');
}
