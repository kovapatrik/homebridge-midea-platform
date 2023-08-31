import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import Cloud from './core/MideaCloud';
import Discover from './core/MideaDiscover';
import { DeviceInfo, Endianness } from './core/MideaConstants';
import AccessoryFactory from './accessory/AccessoryFactory';
import MideaDevice from './core/MideaDevice';
import { LocalSecurity } from './core/MideaSecurity';
import { formatWithOptions } from 'util';

export class MideaPlatform implements DynamicPlatformPlugin {

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  private readonly cloud: Cloud;
  private readonly discover: Discover;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', PLATFORM_NAME);

    this.cloud = new Cloud(this.config['user'], this.config['password'], this.config['useChinaServer'], log);
    this.discover = new Discover(log);
    this.discover.on('device', (device_info: DeviceInfo) => {
      this.addDevice(device_info);
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
        })
        .catch((error) => {
          this.log.error(`Error logging in to Midea Cloud: ${error}`);
        });
    });
  }

  async addDevice(device_info: DeviceInfo) {
    const uuid = this.api.hap.uuid.generate(device_info.id.toString());
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    if (existingAccessory) {
      // the accessory already exists
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
      AccessoryFactory.createAccessory(this, existingAccessory, existingAccessory.context.type);
    } else {
      this.log.info('Adding new accessory:', device_info.name);

      const accessory = new this.api.platformAccessory(device_info.name, uuid);

      const device = new MideaDevice(this.log, device_info, undefined, undefined);

      let connected = false;
      let i = 0;
      while (i <= 1 && !connected) {
        const endianess: Endianness = i === 0 ? 'little' : 'big';
        try {
          const [ token, key ] = await this.cloud.getToken(device_info.id, endianess);
          device.token = token;
          device.key = key;

          await device.connect();
          connected = true;
        } catch (e) {
          this.log.debug(`Connecting with ${endianess}-endian token and key is not successful: ${e}`);
          i++;
        }
      }

      if (connected) {
        this.log.debug(`Connected to device ${device_info.ip}:${device_info.port}`);
        accessory.context.device = device;
        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        AccessoryFactory.createAccessory(this, accessory, device_info.type);

        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      } else {
        this.log.error(`Cannot connect to device ${device_info.ip}:${device_info.port}`);
      }
    }
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }
}
