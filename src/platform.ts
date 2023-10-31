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
import Discover from './core/MideaDiscover';
import { DeviceInfo } from './core/MideaConstants';
import AccessoryFactory from './accessory/AccessoryFactory';
import DeviceFactory from './devices/DeviceFactory';
import { Config, DeviceConfig, defaultConfig, defaultDeviceConfig } from './platformUtils';
import { defaultsDeep } from 'lodash';

export interface MideaAccessory extends PlatformAccessory {
  context: {
    token: string;
    key: string;
    id: string;
    type: string;
    sn: string;
    model: string;
  };
}

export class MideaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: MideaAccessory[] = [];

  private readonly discover: Discover;
  // Need seperate variable because the DynamicPlatformPlugin constructor won't accept anything but the PlatformConfig type
  private readonly platformConfig: Config;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    Error.stackTraceLimit = 100;

    // Add default config values
    this.platformConfig = defaultsDeep(config, defaultConfig);

    this.discover = new Discover(log);

    // Register callback with Discover class that is called for each device as
    // they are discovered on the network.
    this.discover.on('device', this.deviceDiscovered.bind(this));

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', this.finishedLaunching.bind(this));
  }

  /*********************************************************************
   * finishedLaunching
   * Function called when Homebridge has finished loading the plugin.
   */
  private finishedLaunching() {
    this.log.info('Start device discovery...');
    // And then send broadcast to network(s)
    this.discover.startDiscover();
  }

  /*********************************************************************
   * deviceDiscovered
   * Function called by the 'device' on handler.
   */
  private deviceDiscovered(device_info: DeviceInfo) {
    // Find device specific configuration from within the homebridge config file.
    // If we have configuration indexed by ID use that, if not use IP address.
    const deviceConfig = this.platformConfig.devices.find((device: DeviceConfig) => device.id === device_info.id);
    if (deviceConfig) {
      device_info.name = deviceConfig.name ?? device_info.name;
      this.addDevice(device_info, deviceConfig);
    } else {
      this.log.info(`[${device_info.name} | ${device_info.ip}}] Device is not added to config.`);
    }
  }

  /*********************************************************************
   * addDevice
   * Called for each device as discovered on the network.  Creates the
   * Midea device handler and the associated Homebridge accessory.
   */
  private async addDevice(device_info: DeviceInfo, deviceConfig: DeviceConfig) {
    const uuid = this.api.hap.uuid.generate(device_info.id.toString());
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);

    // Add default config values
    defaultsDeep(deviceConfig, defaultDeviceConfig);

    if (existingAccessory) {
      // the accessory already exists, restore from Homebridge cache
      this.log.info(`[${device_info.name}] Restoring existing accessory from cache: ${existingAccessory.displayName}`);
      const device = DeviceFactory.createDevice(this.log, device_info, this.platformConfig, deviceConfig);
      if (device) {
        try {
          if (deviceConfig.advanced_options.token && deviceConfig.advanced_options.key) {
            // token/key provided in config file, use those... replacing values in cached context
            this.log.info(`[${device_info.name}] Cached device, using token/key from config file`);
            existingAccessory.context.token = deviceConfig.advanced_options.token;
            existingAccessory.context.key = deviceConfig.advanced_options.key;
            device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            await device.connect(false);
          } else {
            // use token/key values from the accessory cached context
            this.log.info(`[${device_info.name}] Cached device, using saved credentials`);
            device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            await device.connect(false);
          }
          // Set serial number and model into the context if they are provided.
          existingAccessory.context.sn = device_info.sn ?? 'unknown';
          existingAccessory.context.model = device_info.model ?? 'unknown';
          AccessoryFactory.createAccessory(this, existingAccessory, device, deviceConfig);
        } catch (err) {
          const msg = err instanceof Error ? err.stack : err;
          this.log.error(`Cannot connect to device from cache ${device_info.ip}:${device_info.port}, error:\n${msg}`);
        }
      } else {
        this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
      }
    } else {
      try {
        this.log.info('Adding new accessory:', device_info.name);
        const accessory = new this.api.platformAccessory<MideaAccessory['context']>(device_info.name, uuid);
        const device = DeviceFactory.createDevice(this.log, device_info, this.platformConfig, deviceConfig);
        if (device) {
          // We only need to login to Midea cloud if we are setting up a new accessory.  This is to
          // retrieve token/key credentials.  If device was cached then we already have credentials.
          if (deviceConfig.advanced_options.token && deviceConfig.advanced_options.key) {
            this.log.info(`[${device_info.name}] New device at ${device_info.ip}:${device_info.port}, using token/key from config file`);
            accessory.context.token = deviceConfig.advanced_options.token;
            accessory.context.key = deviceConfig.advanced_options.key;
            accessory.context.id = device_info.id.toString();
            device.setCredentials(Buffer.from(accessory.context.token, 'hex'), Buffer.from(accessory.context.key, 'hex'));
            await device.connect(false);
          } else {
            throw new Error(`Token/key not provided in config file, cannot add new device`);
          }
          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          AccessoryFactory.createAccessory(this, accessory, device, deviceConfig);
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } else {
          throw new Error(`Device type is unsupported by the plugin: ${device_info.type}`);
        }
      } catch (err) {
        this.log.error(
          `[${device_info.name} | ${device_info.ip}:${device_info.port}}] 
          Cannot add new device ${device_info.ip}:${device_info.port}, error:\n${err}`,
        );
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
