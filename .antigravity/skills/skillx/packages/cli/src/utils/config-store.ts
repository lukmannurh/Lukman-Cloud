import { randomUUID } from 'node:crypto';
import Conf from 'conf';

const config = new Conf({ projectName: 'skillx' });

export function getApiKey(): string | undefined {
  return process.env.SKILLX_API_KEY || (config.get('apiKey') as string | undefined);
}

export function setApiKey(key: string): void {
  config.set('apiKey', key);
}

export function getBaseUrl(): string {
  return (config.get('baseUrl') as string) || 'https://skillx.sh';
}

export function setBaseUrl(url: string): void {
  config.set('baseUrl', url);
}

export function getDeviceId(): string {
  let deviceId = config.get('deviceId') as string | undefined;
  if (!deviceId) {
    deviceId = randomUUID();
    config.set('deviceId', deviceId);
  }
  return deviceId;
}
