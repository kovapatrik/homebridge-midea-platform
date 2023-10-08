/***********************************************************************
 * Midea Homebridge platform initialization
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 */
import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import CloudFactory, { CloudBase } from './core/MideaCloud';
import Discover from './core/MideaDiscover';
import { DeviceInfo, Endianness } from './core/MideaConstants';
import AccessoryFactory from './accessory/AccessoryFactory';
import DeviceFactory from './devices/DeviceFactory';
import { DeviceConfig } from './platformUtils';
import { CloudSecurity } from './core/MideaSecurity';
import MideaDevice from './core/MideaDevice';

export interface MideaAccessory extends PlatformAccessory {
  context: {
    token: string;
    key: string;
    id: string;
    type: string;
  };
}

export class MideaPlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: MideaAccessory[] = [];

  private readonly cloud: CloudBase<CloudSecurity>;
  private readonly discover: Discover;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    Error.stackTraceLimit = 100;
    this.log.debug('Finished initializing platform:', PLATFORM_NAME);

    this.cloud = CloudFactory.createCloud(this.config['user'], this.config['password'], log, this.config['registeredApp']);
    this.discover = new Discover(log);

    if (this.config['user'] === undefined || this.config['password'] === undefined) {
      this.log.error('The platform configuration is incomplete.');
      return;
    }

    // Make sure that config settings have a default value
    this.config.forceLogin ??= this.makeBoolean(this.config.forceLogin, false);
    this.config.verbose ??= this.makeBoolean(this.config.verbose, true);
    this.config.refreshInterval ??= 30;

    // Register callback with Discover class that is called for each device as
    // they are discovered on the network.
    this.discover.on('device', (device_info: DeviceInfo) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const configDev: DeviceConfig = this.config['devices'].find((dev: DeviceConfig) => dev.ip === device_info.ip);
      device_info.name = configDev?.name || device_info.name;
      this.addDevice(device_info, configDev);
    });

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      this.log.info('Start device discovery...');
      // Start with sending broadcasts to network(s)
      this.discover.startDiscover();
      // And if individual devices listed in config then probe them directly by IP address
      if (this.config['devices']) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.config['devices'].forEach((device: any) => {
          if (device.ip) {
            this.discover.discoverDeviceByIP(device.ip);
          }
        });
      }
    });
  }

  /*********************************************************************
   * makeBoolean
   * Allow for both 'true' as a boolean and "true" as a string to equal
   * true.  And provide a default for when it is undefined.
   */
  makeBoolean(a, b: boolean): boolean {
    return (typeof a === 'undefined') ? b : String(a).toLowerCase() === 'true' || a === true;
  }

  async addDevice(device_info: DeviceInfo, configDev: DeviceConfig) {
    const uuid = this.api.hap.uuid.generate(device_info.id.toString());
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    if (existingAccessory) {
      // the accessory already exists, restore from Homebridge cache
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
      const device = DeviceFactory.createDevice(this.log, device_info, this.config);
      if (device) {
        try {
          if (this.config.forceLogin) {
            await this.cloud.login();
            const connected = await this.getNewCredentials(device);
            if (connected) {
              this.log.info(`[${device_info.name}] Cached device with forced login, setting new credentials`);
              existingAccessory.context.token = device.token?.toString('hex') as string;
              existingAccessory.context.key = device.key?.toString('hex') as string;
            }
          } else {
            this.log.info(`[${device_info.name}] Cached device, using saved credentials`);
            device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            await device.connect(false);
          }
          AccessoryFactory.createAccessory(this, existingAccessory, device, configDev);
        } catch (err) {
          this.log.error(`Cannot connect to device from cache ${device_info.ip}:${device_info.port}, error: ${err}`);
        }
      } else {
        this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
      }

    } else {
      this.log.info('Adding new accessory:', device_info.name);
      // We only need to login to Midea cloud if we are setting up a new accessory.  This is to
      // retrieve token/key credentials.  If device was cached then we already have credentials.
      await this.cloud.login();
      const accessory = new this.api.platformAccessory<MideaAccessory['context']>(device_info.name, uuid);
      const device = DeviceFactory.createDevice(this.log, device_info, this.config);
      if (device) {
        const connected = await this.getNewCredentials(device);
        if (connected) {
          this.log.info(`[${device_info.name}] New device, setting new credentials`);
          accessory.context.token = device.token?.toString('hex') as string;
          accessory.context.key = device.key?.toString('hex') as string;
          accessory.context.id = device.id.toString();
          accessory.context.type = 'main';

          this.log.info(`Connected to device ${device_info.ip}:${device_info.port}`);
          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          AccessoryFactory.createAccessory(this, accessory, device, configDev);
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else {
          this.log.error(`Cannot connect to device ${device_info.ip}:${device_info.port}`);
        }
      } else {
        this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
      }
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: MideaAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }


  /*********************************************************************
   * getNewCredentials
   * Get new token / key pair from Midea Cloud and set the values
   * into the device object.  Return boolean to signal success or failure.
   */
  private async getNewCredentials(device: MideaDevice): Promise<boolean> {
    let connected = false;
    let i = 0;
    let token: Buffer | undefined, key: Buffer | undefined = undefined;
    // Need to make two passes to obtain token/key credentials as they may work or not
    // depending on byte order (little or big-endian).  Exit the loop as soon as one
    // works or having tried both.
    while (i <= 1 && !connected) {
      const endianess: Endianness = i === 0 ? 'little' : 'big';
      try {
        [token, key] = await this.cloud.getToken(device.id, endianess);
        device.setCredentials(token, key);
      } catch (e) {
        const msg = (e instanceof Error) ? e.stack : e;
        this.log.debug(`Getting token and key with ${endianess}-endian is not successful:\n${msg}`);
      }
      if (token && key) {
        connected = await device.connect(false);
      }
      i++;
    }
    // If, after trying both byte orders, we still did not connect then reset the
    // token / key pair to undefined.  Handle the error in the calling function.
    if (!connected) {
      device.setCredentials(undefined, undefined);
    }
    return connected;
  }
}
