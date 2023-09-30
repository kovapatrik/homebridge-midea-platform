import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import CloudFactory, { CloudBase } from './core/MideaCloud';
import Discover from './core/MideaDiscover';
import { DeviceInfo, Endianness } from './core/MideaConstants';
import AccessoryFactory from './accessory/AccessoryFactory';
import DeviceFactory from './devices/DeviceFactory';
import { DeviceConfig } from './platformUtils';
import { CloudSecurity } from './core/MideaSecurity';

export interface MideaAccessory extends PlatformAccessory {
  context: {
    token?: string;
    key?: string;
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
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.cloud.login()
        .then(() => {
          this.log.info('Logged in to Midea Cloud.');
          this.discover.startDiscover();
          if (this.config['devices']) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.config['devices'].forEach((device: any) => {
              if (device.ip) {
                this.discover.discoverDeviceByIP(device.ip);
              }
            });
          }
        })
        .catch((error) => {
          const msg = (error instanceof Error) ? error.stack : error;
          this.log.error(`Error logging in to Midea Cloud: ${msg}`);
        });
    });
  }

  async addDevice(device_info: DeviceInfo, configDev: DeviceConfig) {
    const uuid = this.api.hap.uuid.generate(device_info.id.toString());
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

      const device = DeviceFactory.createDevice(
        this.log,
        device_info,
        existingAccessory.context.token ? Buffer.from(existingAccessory.context.token, 'hex') : undefined,
        existingAccessory.context.key ? Buffer.from(existingAccessory.context.key, 'hex') : undefined,
        this.config,
      );

      if (device) {
        try {
          await device.connect(false);
          AccessoryFactory.createAccessory(this, existingAccessory, device, configDev);
        } catch (err) {
          this.log.error(`Cannot connect to device from cache ${device_info.ip}:${device_info.port}, error: ${err}`);
        }
      } else {
        this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
      }

    } else {
      this.log.info('Adding new accessory:', device_info.name);

      const accessory = new this.api.platformAccessory<MideaAccessory['context']>(device_info.name, uuid);

      const device = DeviceFactory.createDevice(this.log, device_info, undefined, undefined, this.config);
      if (device) {
        let connected = false;
        let i = 0;
        while (i <= 1 && !connected) {
          const endianess: Endianness = i === 0 ? 'little' : 'big';
          let token: Buffer | undefined, key: Buffer | undefined = undefined;
          try {
            [token, key] = await this.cloud.getToken(device_info.id, endianess);
          } catch (e) {
            this.log.debug(`Getting token and key with ${endianess}-endian is not successful: ${e}`);
          }
          device.token = token;
          device.key = key;

          accessory.context.token = token ? token.toString('hex') : undefined;
          accessory.context.key = key ? key.toString('hex') : undefined;
          accessory.context.id = accessory.UUID;
          accessory.context.type = 'main';

          connected = await device.connect(false);
          i++;
        }

        if (connected) {
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
}
