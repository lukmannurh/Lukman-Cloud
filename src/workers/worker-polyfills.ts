import { Buffer } from 'buffer';

const _global = globalThis as any;

if (typeof _global.window === 'undefined') {
  _global.window = _global;
}
if (typeof _global.document === 'undefined') {
  _global.document = {
    currentScript: null,
    createElement: () => ({})
  } as any;
}

if (!_global.Buffer) {
  _global.Buffer = Buffer;
}

_global.process = {
  env: { NODE_ENV: 'development', browser: true },
  versions: {}, // Explicitly empty to force GramJS into Browser/WebSocket mode
  nextTick: (cb: any) => setTimeout(cb, 0)
} as any;

const originalSetTimeout = _global.setTimeout;

_global.setTimeout = (cb: any, ms?: number, ...args: any[]) => {
  const timeoutId = originalSetTimeout(cb, ms, ...args);
  if (timeoutId) {
    if (typeof timeoutId === 'number') {
      const timeoutObj = Object(timeoutId);
      timeoutObj.unref = () => timeoutId;
      timeoutObj.ref = () => timeoutId;
      return timeoutObj;
    }
    if (typeof timeoutId === 'object') {
      (timeoutId as any).unref = () => timeoutId;
      (timeoutId as any).ref = () => timeoutId;
    }
  }
  return timeoutId;
};
