/***********************************************************************
 * Midea Homebridge platform initialization
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import type { API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service } from 'homebridge';
import lodash from 'lodash';
import AccessoryFactory from './accessory/AccessoryFactory.js';
import CloudFactory from './core/MideaCloud.js';
import { type DeviceInfo, ProtocolVersion } from './core/MideaConstants.js';
import Discover from './core/MideaDiscover.js';
import DeviceFactory from './devices/DeviceFactory.js';
import { type Config, type DeviceConfig, defaultConfig, defaultDeviceConfig } from './platformUtils.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

const { defaultsDeep } = lodash;

type MideaContext = {
  token: string;
  key: string;
  id: string;
  type: string;
  sn: string;
  model: string;
  serviceVersion: number;
  configuredNames: { [key: string]: string };
  thresholds: { [key: string]: number };
};

export type MideaAccessory = PlatformAccessory<MideaContext>;

export class MideaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;

  public readonly accessories: Map<string, MideaAccessory> = new Map();
  public readonly discoveredCacheUUIDs: string[] = [];

  private discoveredDevices: Map<number, boolean> = new Map();
  private discoveryInterval = 60;

  private readonly discover: Discover;
  private readonly platformConfig: Config;

  private tokenRefreshPromise?: Promise<void>;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.Service = api.hap.Service;
    this.Characteristic = api.hap.Characteristic;
    Error.stackTraceLimit = 100;

    this.platformConfig = defaultsDeep(config, defaultConfig);
    this.platformConfig.refreshInterval = Math.max(0, Math.min(this.platformConfig.refreshInterval, 86400));
    this.platformConfig.heartbeatInterval = Math.max(10, Math.min(this.platformConfig.heartbeatInterval, 120));
    this.log.debug(`Configuration:\n${JSON.stringify(this.platformConfig, null, 2)}`);

    this.discover = new Discover(log);

    this.discover.on('device', this.deviceDiscovered.bind(this));
    this.discover.on('complete', this.discoveryComplete.bind(this));
    this.api.on('didFinishLaunching', this.finishedLaunching.bind(this));
  }

  private async refreshTokens(forceRefresh = false): Promise<void> {
    if (!this.platformConfig.account || !this.platformConfig.password) {
      return;
    }

    if (this.tokenRefreshPromise) {
      this.log.debug('Token refresh already in progress, waiting...');
      await this.tokenRefreshPromise;
      return;
    }

    this.tokenRefreshPromise = this.doRefreshTokens(forceRefresh);
    try {
      await this.tokenRefreshPromise;
    } finally {
      this.tokenRefreshPromise = undefined;
    }
  }

  private async validateToken(ip: string, port: number, token: string): Promise<boolean> {
    return new Promise((resolve) => {
      let resolved = false;
      const doResolve = (val: boolean) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      const socket = createConnection({ host: ip, port: port || 6444, timeout: 5000 });

      socket.on('connect', () => {
        const tokenBuf = Buffer.from(token, 'hex');
        const packet = Buffer.concat([
          Buffer.from([0x83, 0x70]),
          Buffer.from([0x00, tokenBuf.length]),
          Buffer.from([0x20, 0x00]),
          Buffer.from([0x00, 0x00]),
          tokenBuf,
        ]);
        socket.write(packet);
      });

      let buffer = Buffer.alloc(0);
      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        if (buffer.length >= 6) {
          const size = buffer.readUInt16BE(2);
          if (buffer.length >= size + 6) {
            const msgType = buffer[5] & 0x0f;
            doResolve(msgType === 0x01);
            socket.destroy();
          }
        }
      });

      socket.on('error', () => doResolve(false));
      socket.on('timeout', () => { socket.destroy(); doResolve(false); });
      socket.on('close', () => doResolve(false));
    });
  }

  private async doRefreshTokens(forceRefresh = false): Promise<void> {
    const account = this.platformConfig.account;
    const password = this.platformConfig.password;
    if (!account || !password) {
      return;
    }
    let cloud: ReturnType<typeof CloudFactory.createCloud>;
    try {
      cloud = CloudFactory.createCloud(account, password, 'NetHome Plus');
      await cloud.login();
    } catch (err) {
      const msg = err instanceof Error ? err.message : err;
      this.log.warn(`Cloud login failed, cannot refresh tokens: ${msg}`);
      return;
    }

    let changed = false;
    for (const device of this.platformConfig.devices) {
      if (!device.id) {
        continue;
      }
      try {
        const [tokenBuf, keyBuf] = await cloud.getTokenKey(device.id, 0);
        const newToken = tokenBuf.toString('hex');
        const newKey = keyBuf.toString('hex');

        const oldToken = device.advanced_options?.token || '';
        const oldKey = device.advanced_options?.key || '';

        if (newToken === oldToken && newKey === oldKey) {
          continue;
        }

        if (!forceRefresh && oldToken) {
          this.log.warn(
            `[${device.name || device.id}] Cloud token differs from config. ` +
            'Skipping update at startup; will validate at runtime if auth fails.',
          );
          continue;
        }

        const isValid = await this.validateToken(
          device.advanced_options?.ip || '',
          6444,
          newToken,
        );
        if (!isValid) {
          this.log.warn(
            `[${device.name || device.id}] Cloud token failed local validation. ` +
            'Keeping existing token. If the device was re-paired with a different app, ' +
            'manually extract the new token from the app traffic.',
          );
          continue;
        }

        this.log.info(`[${device.name || device.id}] Token validated locally — updating config`);
        if (!device.advanced_options) {
          device.advanced_options = { ...defaultDeviceConfig.advanced_options };
        }
        device.advanced_options.token = newToken;
        device.advanced_options.key = newKey;
        changed = true;

        const uuid = this.api.hap.uuid.generate(device.id.toString());
        const accessory = this.accessories.get(uuid);
        if (accessory) {
          accessory.context.token = newToken;
          accessory.context.key = newKey;
          this.api.updatePlatformAccessories([accessory]);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : err;
        this.log.warn(`[${device.name || device.id}] Failed to refresh token: ${msg}`);
      }
    }

    if (changed) {
      this.saveConfig();
    }
  }

  private saveConfig(): void {
    try {
      const configPath = this.api.user.configPath();
      const raw = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);

      for (const platform of config.platforms || []) {
        if (platform.platform === PLATFORM_NAME) {
          platform.devices = this.platformConfig.devices;
          break;
        }
      }

      writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
      this.log.info('Updated config.json with refreshed tokens');
    } catch (err) {
      const msg = err instanceof Error ? err.message : err;
      this.log.error(`Failed to persist updated config: ${msg}`);
    }
  }

  private async finishedLaunching() {
    await this.refreshTokens(false);
    this.log.info('Start device discovery...');
    for (let device of this.platformConfig.devices) {
      const regexIPv4 = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
      device = defaultsDeep(device, defaultDeviceConfig);
      const ip = device.advanced_options.ip.toString().trim();
      if (regexIPv4.test(ip)) {
        this.discover.discoverDeviceByIP(ip);
      } else if (ip) {
        this.log.warn(`[${device.name}] Invalid IP address in configuration: ${ip}`);
      }
    }
    this.discover.startDiscover();
  }

  private deviceDiscovered(device_info: DeviceInfo) {
    const deviceConfig = this.platformConfig.devices.find((device: DeviceConfig) => device.id === device_info.id);
    if (deviceConfig) {
      this.discoveredDevices.set(device_info.id, true);
      device_info.name = deviceConfig.name ?? device_info.name;
      this.addDevice(device_info, deviceConfig);
    } else {
      this.log.warn(`[${device_info.name} | ${device_info.ip}}] New device discovered, you must add it to the config.json settings.`);
    }
  }

  private discoveryComplete() {
    this.log.debug('Discovery complete, check for missing devices');
    let missingDevices = 0;
    for (const device of this.platformConfig.devices) {
      if (!this.discoveredDevices.get(device.id)) {
        missingDevices++;
        if (this.discoveredDevices.get(device.id) === undefined) {
          this.discoveredDevices.set(device.id, false);
          this.log.warn(`[${device.name}] Device not found (id: ${device.id}), will retry every ${this.discoveryInterval} seconds`);
        } else {
          this.log.debug(`[${device.name}] Device not found (id: ${device.id}), will retry in ${this.discoveryInterval} seconds`);
        }
      }
    }
    if (missingDevices > 0) {
      setTimeout(() => {
        missingDevices = 0;
        this.discover.startDiscover(1, 3000);
      }, this.discoveryInterval * 1000);
    }
  }

  private async addDevice(device_info: DeviceInfo, deviceConfig: DeviceConfig) {
    const uuid = this.api.hap.uuid.generate(device_info.id.toString());
    const existingAccessory = this.accessories.get(uuid);

    defaultsDeep(deviceConfig, defaultDeviceConfig);
    const device = DeviceFactory.createDevice(this.log, device_info, this.platformConfig, deviceConfig);
    if (device === null) {
      this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
    } else {
      if (existingAccessory) {
        this.log.info(`[${device_info.name}] Restoring existing accessory from cache: ${existingAccessory.displayName}`);
        try {
          if (device_info.version === ProtocolVersion.V3) {
            if (deviceConfig.advanced_options.token && deviceConfig.advanced_options.key) {
              this.log.info(`[${device_info.name}] Cached device, using token/key from config file`);
              existingAccessory.context.token = deviceConfig.advanced_options.token;
              existingAccessory.context.key = deviceConfig.advanced_options.key;
              device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            } else {
              this.log.info(`[${device_info.name}] Cached device, using saved credentials`);
              device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            }
          }
          device.on('authFailure', async ({ id }: { id: number }) => {
            this.log.warn(`[${id}] Authentication failed, attempting token refresh...`);
            await this.refreshTokens(true);
          });
          await device.connect(true);
          AccessoryFactory.createAccessory(this, existingAccessory, device, deviceConfig);
        } catch (err) {
          const msg = err instanceof Error ? err.stack : err;
          this.log.error(`Cannot connect to device from cache ${device_info.ip}:${device_info.port}, error:\n${msg}`);
        }
      } else {
        try {
          this.log.info('Adding new accessory:', device_info.name);
          const accessory = new this.api.platformAccessory<MideaAccessory['context']>(device_info.name, uuid);
          if (device_info.version === ProtocolVersion.V3) {
            if (deviceConfig.advanced_options.token && deviceConfig.advanced_options.key) {
              this.log.info(`[${device_info.name}] New device at ${device_info.ip}:${device_info.port}, using token/key from config file`);
              accessory.context.token = deviceConfig.advanced_options.token;
              accessory.context.key = deviceConfig.advanced_options.key;
              accessory.context.id = device_info.id.toString();
              device.setCredentials(Buffer.from(accessory.context.token, 'hex'), Buffer.from(accessory.context.key, 'hex'));
            } else {
              throw new Error('Token/key not provided in config file, cannot add new device');
            }
          }
          device.on('authFailure', async ({ id }: { id: number }) => {
            this.log.warn(`[${id}] Authentication failed, attempting token refresh...`);
            await this.refreshTokens(true);
          });
          await device.connect(false);
          await device.refresh_status();
          accessory.context.sn = device_info.sn ?? 'unknown';
          accessory.context.model = device_info.model ?? 'unknown';
          AccessoryFactory.createAccessory(this, accessory, device, deviceConfig);
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (err) {
          this.log.error(
            `[${device_info.name} | ${device_info.ip}:${device_info.port}}]
            Cannot add new device ${device_info.ip}:${device_info.port}, error:\n${err}`,
          );
        }
      }

      this.discoveredCacheUUIDs.push(uuid);
    }
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.set(accessory.UUID, accessory as MideaAccessory);
  }
}