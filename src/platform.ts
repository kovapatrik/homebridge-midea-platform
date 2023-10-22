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
import { DeviceInfo, DeviceType, Endianness } from './core/MideaConstants';
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

/*********************************************************************
 * makeBoolean
 * Allow for both 'true' as a boolean and "true" as a string to equal
 * true.  And provide a default for when it is undefined.
 */
export function makeBoolean(a, b: boolean): boolean {
  return typeof a === 'undefined' ? b : String(a).toLowerCase() === 'true' || a === true;
}

export class MideaPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  public readonly accessories: MideaAccessory[] = [];

  private readonly cloud: CloudBase<CloudSecurity>;
  private readonly discover: Discover;

  private devices = {};

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    Error.stackTraceLimit = 100;

    // Make sure that config settings have a default value
    this.config.forceLogin ??= makeBoolean(this.config.forceLogin, false);
    this.config.verbose ??= makeBoolean(this.config.verbose, true);
    this.config.logRecoverableErrors ??= makeBoolean(this.config.logRecoverableErrors, true);
    // make sure values are between allowed range and set to default if undefined.
    this.config.refreshInterval = Math.max(0, Math.min(this.config.refreshInterval ?? 30, 86400));
    this.config.heartbeatInterval = Math.max(10, Math.min(this.config.heartbeatInterval ?? 10, 120));
    // make sure devices / devicesById / IP is never undefined.
    this.config.devices ??= {};
    this.config.devicesById = {};
    this.config.devicesByIP = {};

    // transforms array of devices into object that can be referenced by deviceId...
    if (this.config.devices) {
      // If we have a deviceId then we copy it into another object and remove it
      // from the array.  This allows us to index into configuration by deviceId.
      // TODO: type this
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.config.devices = this.config.devices.filter((elem: any) => {
        // make sure config object exists.
        elem.config ??= {};
        if (elem.deviceId) {
          // copy the values into the config object before we delete this object.
          elem.config.id = elem.deviceId;
          elem.config.ip = elem.ip;
          elem.config.name = elem.name;
          elem.config.type = DeviceType[String(elem.type).toUpperCase()];
          this.config.devicesById[String(elem.deviceId).toLowerCase()] = elem.config;
          return false; // deletes this entry from the devices array so we don't have duplicates.
        } else if (elem.ip) {
          // copy the values into the config object before we delete this object.
          elem.config.ip = elem.ip;
          elem.config.name = elem.name;
          elem.config.type = DeviceType[String(elem.type).toUpperCase()];
          this.config.devicesByIP[String(elem.ip).toLowerCase()] = elem.config;
          return false; // deletes this entry from the devices array so we don't have duplicates.
        }
        return true;
      });
    }
    this.log.debug(`[${PLATFORM_NAME}] Configuration:\n${JSON.stringify(this.config, null, 2)}`);

    this.log.info(`Force login is set to ${this.config.forceLogin}`);
    this.log.info(`Verbose debug logging is set to ${this.config.verbose}`);
    this.log.info(`Log recoverable errors is set to ${this.config.logRecoverableErrors}`);
    this.log.info(`Device refresh interval set to ${this.config.refreshInterval} seconds`);
    this.log.info(`Socket heartbeat interval set to ${this.config.heartbeatInterval} seconds`);

    this.cloud = CloudFactory.createCloud(this.config.user, this.config.password, log, this.config.registeredApp);
    this.discover = new Discover(log);

    //if (!(this.config.user && this.config.password)) {
    //  this.log.error('The platform configuration is incomplete, missing "user" and "password"');
    //  return;
    //}

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
  private finishedLaunching(this: MideaPlatform) {
    this.log.info('Start device discovery...');
    // If individual devices are listed in config then probe them directly by IP address
    if (this.config.devicesById) {
      (Object.values(this.config.devicesById) as DeviceConfig[]).forEach((device: DeviceConfig) => {
        if (device.ip) {
          this.log.info(
            `[${PLATFORM_NAME}] Send discover for user configured device: ${device.name} (ID: ${device.id},  IP: ${device.ip})`,
          );
          this.discover.discoverDeviceByIP(device.ip);
        }
      });
    }
    if (this.config.devicesByIP) {
      (Object.values(this.config.devicesByIP) as DeviceConfig[]).forEach((device: DeviceConfig) => {
        if (device.ip) {
          this.log.info(
            `[${PLATFORM_NAME}] Send discover for user configured device: ${device.name} (ID: ${device.id},  IP: ${device.ip})`,
          );
          this.discover.discoverDeviceByIP(device.ip);
        }
      });
    }
    // And then send broadcast to network(s)
    this.discover.startDiscover();
  }

  /*********************************************************************
   * deviceDiscovered
   * Function called by the 'device' on handler.
   */
  private deviceDiscovered(this: MideaPlatform, device_info: DeviceInfo) {
    // Find device specific configuration from within the homebridge config file.
    // If we have configuration indexed by ID use that, if not use IP address.
    const deviceConfig: DeviceConfig = this.config.devicesById[device_info.id] ?? this.config.devicesByIP[device_info.ip];

    device_info.name = deviceConfig?.name ?? device_info.name;

    this.devices[device_info.id] = {};
    this.devices[device_info.id].name = device_info.name;
    this.devices[device_info.id].ip = device_info.ip;
    this.devices[device_info.id].type = device_info.type;
    // If token/key provided in config file then use those...
    if (deviceConfig?.token && deviceConfig?.key) {
      this.devices[device_info.id].token = deviceConfig.token;
      this.devices[device_info.id].key = deviceConfig.key;
    }

    // deviceConfig could be undefined, at least pass in a name field...
    this.addDevice(device_info, deviceConfig ?? { name: device_info.name });
  }

  /*********************************************************************
   * discoveryComplete
   * Function called by the 'complete' on handler.
   */
  private discoveryComplete(this: MideaPlatform) {
    // Check if network broadcasting found all devices that user configured.  If not then
    // we have to handle those.
    for (const key of Object.keys(this.config.devicesById)) {
      if (!(key in this.devices)) {
        // This device was not found by network discovery.
        const missingDev: DeviceConfig = this.config.devicesById[key];
        this.log.warn(
          `[${missingDev.name}] Manually configured device not found by network discovery (id: ${missingDev.id}, ip: ${missingDev.ip})`,
        );
        // TODO... Figure out if we can add a device that is offline, so that it will work when
        // it comes back online without restarting plugin.
      }
    }
    for (const key of Object.keys(this.config.devicesByIP)) {
      if (!Object.values(this.devices).find((elem) => (elem as DeviceConfig).ip === key)) {
        // This device was not found by network discovery.
        const missingDev: DeviceConfig = this.config.devicesByIP[key];
        this.log.warn(`[${missingDev.name}] Manually configured device not found by network discovery (ip: ${missingDev.ip})`);
        // TODO... Figure out if we can add a device that is offline, so that it will work when
        // it comes back online without restarting plugin.
      }
    }

    // now we can summarize details of all discovered devices which we will print to
    // log so that a user can easily copy/paste into the config file if they want.
    const deviceConfigArray: object[] = [];
    for (const [key, value] of Object.entries(this.devices)) {
      const v = value as DeviceConfig;
      const obj = {
        type: Object.keys(DeviceType)
          .find((key) => DeviceType[key] === v.type)
          ?.toLocaleLowerCase(),
        name: v.name,
        ip: v.ip,
        deviceId: String(key),
        config: {
          token: v.token,
          key: v.key,
        },
      };
      deviceConfigArray.push(obj);
    }
    this.log.info(`\n"devices": ${JSON.stringify(deviceConfigArray, null, 2)}`);
  }

  /*********************************************************************
   * addDevice
   * Called for each device as discovered on the network.  Creates the
   * Midea device handler and the associated Homebridge accessory.
   */
  private async addDevice(device_info: DeviceInfo, deviceConfig: DeviceConfig) {
    const uuid = this.api.hap.uuid.generate(device_info.id.toString());
    const existingAccessory = this.accessories.find((accessory) => accessory.UUID === uuid);
    if (existingAccessory) {
      // the accessory already exists, restore from Homebridge cache
      this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
      const device = DeviceFactory.createDevice(this.log, device_info, this.config, deviceConfig);
      if (device) {
        try {
          if (this.config.forceLogin) {
            // force login, which will obtain a new token/key pair
            await this.cloud.login();
            const connected = await this.getNewCredentials(device);
            if (connected) {
              this.log.info(`[${device_info.name}] Cached device with forced login, setting new credentials`);
              this.devices[device_info.id].token = device.token?.toString('hex');
              this.devices[device_info.id].key = device.key?.toString('hex');
              existingAccessory.context.token = this.devices[device_info.id].token as string;
              existingAccessory.context.key = this.devices[device_info.id].key as string;
            }
          } else if (this.devices[device_info.id].token && this.devices[device_info.id].key) {
            // token/key provided in config file, use those... replacing values in cached context
            this.log.info(`[${device_info.name}] Cached device, using token/key from config file`);
            existingAccessory.context.token = this.devices[device_info.id].token as string;
            existingAccessory.context.key = this.devices[device_info.id].key as string;
            device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            await device.connect(false);
          } else {
            // use token/key values from the accessory cached context
            this.log.info(`[${device_info.name}] Cached device, using saved credentials`);
            this.devices[device_info.id].token = existingAccessory.context.token;
            this.devices[device_info.id].key = existingAccessory.context.key;
            device.setCredentials(Buffer.from(existingAccessory.context.token, 'hex'), Buffer.from(existingAccessory.context.key, 'hex'));
            await device.connect(false);
          }

          AccessoryFactory.createAccessory(this, existingAccessory, device, deviceConfig);
        } catch (err) {
          this.log.error(`Cannot connect to device from cache ${device_info.ip}:${device_info.port}, error: ${err}`);
        }
      } else {
        this.log.error(`Device type is unsupported by the plugin: ${device_info.type}`);
      }
    } else {
      this.log.info('Adding new accessory:', device_info.name);
      const accessory = new this.api.platformAccessory<MideaAccessory['context']>(device_info.name, uuid);
      const device = DeviceFactory.createDevice(this.log, device_info, this.config, deviceConfig);
      if (device) {
        // We only need to login to Midea cloud if we are setting up a new accessory.  This is to
        // retrieve token/key credentials.  If device was cached then we already have credentials.
        if (!this.config.forceLogin && this.devices[device_info.id].token && this.devices[device_info.id].key) {
          this.log.info(`[${device_info.name}] New device at ${device_info.ip}:${device_info.port}, using token/key from config file`);
          accessory.context.token = this.devices[device_info.id].token as string;
          accessory.context.key = this.devices[device_info.id].key as string;
          accessory.context.id = device_info.id.toString();
          accessory.context.type = 'main';
          device.setCredentials(Buffer.from(accessory.context.token, 'hex'), Buffer.from(accessory.context.key, 'hex'));
          await device.connect(false);
        } else {
          await this.cloud.login();
          const connected = await this.getNewCredentials(device);
          if (connected) {
            this.log.info(`[${device_info.name}] New device at ${device_info.ip}:${device_info.port}, setting new credentials`);
            accessory.context.token = device.token?.toString('hex') as string;
            accessory.context.key = device.key?.toString('hex') as string;
            accessory.context.id = device.id.toString();
            accessory.context.type = 'main';
            this.devices[device_info.id].token = accessory.context.token;
            this.devices[device_info.id].key = accessory.context.key;
          } else {
            this.log.error(`[${device_info.name}] Cannot connect to device ${device_info.ip}:${device_info.port}`);
            if (this.devices[device_info.id].token && this.devices[device_info.id].key) {
              this.log.info(`[${device_info.name}] Using token/key from config file`);
              accessory.context.token = this.devices[device_info.id].token as string;
              accessory.context.key = this.devices[device_info.id].key as string;
              accessory.context.id = device_info.id.toString();
              accessory.context.type = 'main';
              device.setCredentials(Buffer.from(accessory.context.token, 'hex'), Buffer.from(accessory.context.key, 'hex'));
            }
          }
        }
        // create the accessory handler for the newly create accessory
        // this is imported from `platformAccessory.ts`
        AccessoryFactory.createAccessory(this, accessory, device, deviceConfig);
        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
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
    let token: Buffer | undefined = undefined;
    let key: Buffer | undefined = undefined;
    // Need to make two passes to obtain token/key credentials as they may work or not
    // depending on byte order (little or big-endian).  Exit the loop as soon as one
    // works or having tried both.
    while (i <= 1 && !connected) {
      const endianess: Endianness = i === 0 ? 'little' : 'big';
      try {
        [token, key] = await this.cloud.getToken(device.id, endianess);
        device.setCredentials(token, key);
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
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
    } else {
      if (this.config.verbose) {
        this.log.debug(`[${device.name}] New token/key from cloud: ` + `${token?.toString('hex')} / ${key?.toString('hex')}`);
      }
    }
    return connected;
  }
}
