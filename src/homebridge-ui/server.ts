/***********************************************************************
 * Midea Homebridge platform Custom UI server-side script
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/plugin-ui-utils
 *
 */
import fs from 'node:fs';
import { HomebridgePluginUiServer, RequestError } from '@homebridge/plugin-ui-utils';
import createCloud, { ProxiedCloudBase, type CloudBase } from '../core/MideaCloud.js';
import { DeviceTypeToName, Endianness, ProtocolVersion, TCPMessageType } from '../core/MideaConstants.js';
import Discover from '../core/MideaDiscover.js';
import { type CloudSecurity, LocalSecurity, ProxiedSecurity } from '../core/MideaSecurity.js';
import { PromiseSocket } from '../core/MideaUtils.js';

const DEFAULT_ACCOUNT = [
  BigInt('41136566961777418441619689108052131385308997994436615360276316597550126349990'),
  BigInt('41136566961777418205521495345904086238221761646585049169700858993146668339659'),
  BigInt('41136566961777418441619689108052131385308997994436615362339979365072738212503'),
];

const DEFAULT_SMARTHOME_ACCOUNT = [
  BigInt('4270685954756226103292057380984602745528999549492916172461797725852782444008'),
  BigInt('4270685954756226103289246300068351442953216461967596801287597164299361014405'),
  BigInt('4270685954756226103292057380984602757738380835485182656166614575373678037465'),
];

class Logger {
  private _debug: boolean;
  private readonly _Reset = '\x1b[0m';
  private readonly _FgRed = '\x1b[31m';
  private readonly _FgGreen = '\x1b[32m';
  private readonly _FgYellow = '\x1b[33m';
  private readonly _FgWhite = '\x1b[37m';
  private readonly _FgGray = '\x1b[90m';

  constructor(uiDebug = false) {
    this._debug = uiDebug;
  }

  info(msg: string) {
    console.info(this._FgWhite + msg + this._Reset);
  }

  success(msg: string) {
    console.info(this._FgGreen + msg + this._Reset);
  }

  warn(msg: string) {
    console.warn(this._FgYellow + msg + this._Reset);
  }

  error(msg: string) {
    console.error(this._FgRed + msg + this._Reset);
  }

  debug(msg: string) {
    if (this._debug) console.debug(this._FgGray + msg + this._Reset);
  }

  log(level: string, msg: string) {
    switch (level) {
      case 'success':
        this.success(msg);
        break;
      case 'warn':
        this.warn(msg);
        break;
      case 'error':
        this.error(msg);
        break;
      case 'debug':
        this.debug(msg);
        break;
      default:
        this.info(msg);
    }
  }

  setDebugEnabled(enabled = true) {
    this._debug = enabled;
  }
}

type DiscoveredDevice = {
  id: number;
  name: string;
  type: number;
  sn: string;
  model: string;
  version: number;
  ip: string;
  port: number;
  displayName?: string;
  token?: string;
  key?: string;
};

class UiServer extends HomebridgePluginUiServer {
  cloud!: CloudBase<CloudSecurity>;
  smartHomeCloud?: ProxiedCloudBase<ProxiedSecurity>;
  promiseSocket: PromiseSocket;
  security: LocalSecurity;
  logger: Logger;

  constructor() {
    super();
    const config = (
      JSON.parse(fs.readFileSync(this.homebridgeConfigPath!, 'utf8')) as { platforms: Array<{ platform: string; uiDebug?: boolean }> }
    ).platforms.find((obj) => obj.platform === 'midea-platform');
    this.logger = new Logger(config?.uiDebug ?? false);
    this.logger.info('Custom UI created.');
    this.security = new LocalSecurity();
    this.promiseSocket = new PromiseSocket(this.logger, config?.uiDebug ?? false);

    this.onRequest(
      '/login',
      async ({
        username,
        password,
        registeredApp,
        useDefaultProfile,
      }: {
        username: string;
        password: string;
        registeredApp: string;
        useDefaultProfile: boolean;
      }) => {
        try {
          let effectiveUsername = username;
          let effectivePassword = password;
          let effectiveApp = registeredApp;
          if (useDefaultProfile) {
            this.logger.debug('Using default profile.');
            effectiveApp = 'NetHome Plus';
            effectiveUsername = Buffer.from((DEFAULT_ACCOUNT[0] ^ DEFAULT_ACCOUNT[1]).toString(16), 'hex').toString('ascii');
            effectivePassword = Buffer.from((DEFAULT_ACCOUNT[0] ^ DEFAULT_ACCOUNT[2]).toString(16), 'hex').toString('ascii');
          }
          if (!effectiveUsername || !effectivePassword || !effectiveApp) {
            throw new RequestError('Login failed! Username, password or the name of the registered app is missing.', { status: 501 });
          }
          this.cloud = createCloud(effectiveUsername, effectivePassword, effectiveApp);
          await this.cloud.login();
        } catch (e) {
          const msg = e instanceof Error ? e.stack : e;
          this.logger.warn(`Login failed:\n${msg}`);
          throw new RequestError('Login failed! Check the logs for more information.', e);
        }
      },
    );

    this.onRequest('/discover', async ({ ip }: { ip: string[] | undefined }) => {
      try {
        const devices = await this.blockingDiscover(ip);
        for (const device of devices) {
          if (device.version === ProtocolVersion.V3 && this.cloud.loggedIn) {
            await this.getNewCredentials(device);
          } else {
            device.token = '';
            device.key = '';
          }
        }
        this.logger.debug(`All devices:\n${JSON.stringify(devices, null, 2)}`);
        return devices.filter((a) => Object.keys(a).length > 0).sort((a, b) => a.ip.localeCompare(b.ip));
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
        throw new RequestError(`Device discovery failed:\n${msg}`, e);
      }
    });

    this.onRequest('/downloadLua', async ({ deviceType, deviceSn }: { deviceType: number; deviceSn: string }) => {
      try {
        if (!this.smartHomeCloud) {
          const username = Buffer.from((DEFAULT_SMARTHOME_ACCOUNT[0] ^ DEFAULT_SMARTHOME_ACCOUNT[1]).toString(16), 'hex').toString('ascii');
          const password = Buffer.from((DEFAULT_SMARTHOME_ACCOUNT[0] ^ DEFAULT_SMARTHOME_ACCOUNT[2]).toString(16), 'hex').toString('ascii');
          this.smartHomeCloud = createCloud(username, password, 'Midea SmartHome (MSmartHome)') as ProxiedCloudBase<ProxiedSecurity>;
        }
        if (!this.smartHomeCloud.loggedIn) {
          await this.smartHomeCloud.login();
        }
        const lua = await this.smartHomeCloud.getProtocolLua(deviceType, deviceSn);
        return lua;
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
        throw new RequestError(`Download Lua failed:\n${msg}`, e);
      }
    });

    this.ready();
  }

  async getNewCredentials(device: DiscoveredDevice): Promise<void> {
    let connected = false;
    let i = 0;
    this.logger.info(`[${device.name}] Retrieve credentials.`);
    while (i <= 1 && !connected) {
      const endianess = i === 0 ? Endianness.Little : Endianness.Big;
      try {
        const [token, key] = await this.cloud.getTokenKey(device.id, endianess);
        device.token = token ? token.toString('hex') : undefined;
        device.key = key ? key.toString('hex') : undefined;
        await this.authenticate(device);
        connected = true;
      } catch (e) {
        this.logger.debug(`[${device.name}] Getting token and key with ${endianess}-endian is not successful.\n${e}`);
        device.token = undefined;
        device.key = undefined;
      }
      i++;
    }
    this.logger.debug(`[${device.name}] Token: ${device.token}, Key: ${device.key}`);
  }

  async authenticate(device: DiscoveredDevice): Promise<void> {
    if (!(device.token && device.key)) {
      throw new Error(`[${device.name}] Token or key is missing!`);
    }
    await this.promiseSocket.connect(device.port, device.ip);
    try {
      const request = this.security.encode_8370(Buffer.from(device.token, 'hex'), TCPMessageType.HANDSHAKE_REQUEST);
      await this.promiseSocket.write(request);
      const response = await this.promiseSocket.read();
      if (response) {
        if (response.length < 20) {
          this.logger.debug(
            `[${device.name}] Authenticate error when receiving data from ${device.ip}:${device.port}. (Data length: ${response.length})\n${JSON.stringify(response)}`,
          );
          throw Error(`[${device.name}] Authenticate error when receiving data from ${device.ip}:${device.port}. (Data length mismatch)`);
        }
        const resp = response.subarray(8, 72);
        this.security.tcp_key_from_resp(resp, Buffer.from(device.key, 'hex'));
      } else {
        throw Error(`[${device.name}] Authenticate error when receiving data from ${device.ip}:${device.port}.`);
      }
    } finally {
      this.promiseSocket.destroy();
    }
  }

  async blockingDiscover(ipAddrs?: string[]): Promise<DiscoveredDevice[]> {
    const devices: DiscoveredDevice[] = [];
    this.logger.debug(`[blockingDiscover] IP addresses: ${JSON.stringify(ipAddrs)}`);
    const discover = new Discover(this.logger);
    return new Promise((resolve) => {
      this.logger.info('Start device discovery...');
      this.pushEvent('showToast', { success: true, msg: 'Start device discovery' });

      if (ipAddrs && ipAddrs.length > 0) {
        for (const ip of ipAddrs) {
          discover.discoverDeviceByIP(ip);
        }
      }
      discover.startDiscover();

      discover.on('device', async (device: DiscoveredDevice) => {
        device.displayName = DeviceTypeToName[device.type as keyof typeof DeviceTypeToName] ?? 'Unknown';
        devices.push(device);
      });

      discover.on('retry', (_nTry: number, nDevices: number) => {
        this.logger.info('Device discovery complete.');
        this.pushEvent('showToast', { success: true, msg: `Continuing to search for devices (${nDevices} found)` });
      });

      discover.on('complete', () => {
        this.logger.info('Device discovery complete.');
        this.pushEvent('showToast', { success: true, msg: 'Discovery complete' });
        resolve(devices);
      });
    });
  }
}

(() => {
  return new UiServer();
})();
