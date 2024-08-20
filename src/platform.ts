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
import { DeviceInfo, ProtocolVersion } from './core/MideaConstants';
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
    serviceVersion: number;
  };
}

export class MideaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: MideaAccessory[] = [];

  // Keep track of all devices discovered by broadcast
  private discoveredDevices = {};
  private discoveryInterval = 60; // seconds

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
    // Enforce min/max values
    this.platformConfig.refreshInterval = Math.max(0, Math.min(this.platformConfig.refreshInterval, 86400));
    this.platformConfig.heartbeatInterval = Math.max(10, Math.min(this.platformConfig.heartbeatInterval, 120));
    // debug log configuration
    this.log.debug(`Configuration:\n${JSON.stringify(this.platformConfig, null, 2)}`);

    this.discover = new Discover(log);

    // Register callback with Discover class that is called for each device as
    // they are discovered on the network.
    this.discover.on('device', this.deviceDiscovered.bind(this));

    // Register callback with Discover class that is called when we have exhausted
    // all retries to discover devices.  We can now check what was found.
    this.discover.on('complete', this.discoveryComplete.bind(this));

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
    // If IP address is in config then probe them directly
    this.platformConfig.devices.forEach((device) => {
      // for some reason, assigning the regex has to be inside the loop, else fails after first pass.
      const regexIPv4 = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
      // Pull in defaults
      device = defaultsDeep(device, defaultDeviceConfig);
      const ip = device.advanced_options.ip.toString().trim();
      if (regexIPv4.test(ip)) {
        this.discover.discoverDeviceByIP(ip);
      } else if (ip) {
        // IP is non-empty, non-null, but not valid IP address
        this.log.warn(`[${device.name}] Invalid IP address in configuration: ${ip}`);
      }
    });
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
      // keep track of discovered devices
      this.discoveredDevices[device_info.id] = true;
      // Override name with that provided in the config.json settings
      device_info.name = deviceConfig.name ?? device_info.name;
      this.addDevice(device_info, deviceConfig);
    } else {
      this.log.warn(`[${device_info.name} | ${device_info.ip}}] New device discovered, you must add it to the config.json settings.`);
    }
  }

  /*********************************************************************
   * discoveryComplete
   * Function called by the 'complete' on handler.
   */
  private discoveryComplete() {
    this.log.debug(`Discovery complete, check for missing devices`);
    // Check if network broadcasting found all devices that user configured.  If not then
    // we have to handle those.
    let missingDevices = 0;
    this.platformConfig.devices.forEach((device) => {
      if (!this.discoveredDevices[device.id]) {
        // This device was not found by network discovery.
        missingDevices++;
        if (this.discoveredDevices[device.id] === undefined) {
          this.discoveredDevices[device.id] = false;
          this.log.warn(`[${device.name}] Device not found (id: ${device.id}), will retry every ${this.discoveryInterval} seconds`);
        } else {
          this.log.debug(`[${device.name}] Device not found (id: ${device.id}), will retry in ${this.discoveryInterval} seconds`);
        }
      }
    });
    if (missingDevices > 0) {
      // Some devices not found. Keep retrying periodically until all are found.
      setTimeout(() => {
        missingDevices = 0;
        // on repeat attempts only retry once (so two broadcasts sent), 3000 miliseconds apart.
        this.discover.startDiscover(1, 3000);
      }, this.discoveryInterval * 1000);
    } else {
      this.log.info(`All configured devices added to Homebridge`);
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
    const device = DeviceFactory.createDevice(this.log, device_info, this.platformConfig, deviceConfig);
    if (device === null) {
      this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
    } else {
      if (existingAccessory) {
        // the accessory already exists, restore from Homebridge cache
        this.log.info(`[${device_info.name}] Restoring existing accessory from cache: ${existingAccessory.displayName}`);
        try {
          // Token/key is only required for V3 devices
          if (device_info.version === ProtocolVersion.V3) {
            if (deviceConfig.advanced_options.token && deviceConfig.advanced_options.key) {
              // token/key provided in config file, use those... replacing values in cached context
              this.log.info(`[${device_info.name}] Cached device, using token/key from config file`);
              existingAccessory.context.token = deviceConfig.advanced_options.token;
              existingAccessory.context.key = deviceConfig.advanced_options.key;
              device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            } else {
              // use token/key values from the accessory cached context
              this.log.info(`[${device_info.name}] Cached device, using saved credentials`);
              device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            }
          }
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
          // Token/key is only required for V3 devices
          if (device_info.version === ProtocolVersion.V3) {
            if (deviceConfig.advanced_options.token && deviceConfig.advanced_options.key) {
              // token/key provided in config file, use those... set values in cached context
              this.log.info(`[${device_info.name}] New device at ${device_info.ip}:${device_info.port}, using token/key from config file`);
              accessory.context.token = deviceConfig.advanced_options.token;
              accessory.context.key = deviceConfig.advanced_options.key;
              accessory.context.id = device_info.id.toString();
              device.setCredentials(Buffer.from(accessory.context.token, 'hex'), Buffer.from(accessory.context.key, 'hex'));
            } else {
              throw new Error(`Token/key not provided in config file, cannot add new device`);
            }
          }
          await device.connect(false);
          await device.refresh_status();
          // Set serial number and model into the context if they are provided.
          accessory.context.sn = device_info.sn ?? 'unknown';
          accessory.context.model = device_info.model ?? 'unknown';
          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          AccessoryFactory.createAccessory(this, accessory, device, deviceConfig);
          // link the accessory to your platform
          this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
        } catch (err) {
          this.log.error(
            `[${device_info.name} | ${device_info.ip}:${device_info.port}}] 
            Cannot add new device ${device_info.ip}:${device_info.port}, error:\n${err}`,
          );
        }
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
