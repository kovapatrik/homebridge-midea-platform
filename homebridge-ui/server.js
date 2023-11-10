/***********************************************************************
 * Midea Homebridge platform Custom UI server-side script
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/plugin-ui-utils
 *
 */
const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');
const Discover = require('../dist/core/MideaDiscover.js').default;
const CloudFactory = require('../dist/core/MideaCloud.js').default;
const { DeviceType, TCPMessageType } = require("../dist/core/MideaConstants.js");
const { LocalSecurity } = require("../dist/core/MideaSecurity.js");
const { PromiseSocket } = require("../dist/core/MideaUtils.js");
const { defaultConfig, defaultDeviceConfig } = require('../dist/platformUtils.js');

var _ = require('lodash');

/*********************************************************************
 * Logger
 * Lightweight log class to mimic the homebridge log capability
 */
class Logger {
  _debug;
  _Reset = "\x1b[0m";
  _Bright = "\x1b[1m";
  _Dim = "\x1b[2m";

  _FgBlack = "\x1b[30m";
  _FgRed = "\x1b[31m";
  _FgGreen = "\x1b[32m";
  _FgYellow = "\x1b[33m";
  _FgBlue = "\x1b[34m";
  _FgMagenta = "\x1b[35m";
  _FgCyan = "\x1b[36m";
  _FgWhite = "\x1b[37m";
  _FgGray = "\x1b[90m";

  constructor(uiDebug = false) {
    this._debug = uiDebug;
  }
  info(str) {
    console.info(this._FgWhite + str + this._Reset);
  }
  warn(str) {
    console.warn(this._FgYellow + str + this._Reset);
  }
  error(str) {
    console.error(this._FgRed + str + this._Reset);
  }
  debug(str) {
    if (this._debug) {
      console.debug(this._FgGray + str + this._Reset);
    }
  }
  setDebugEnabled(enabled = true) {
    this._debug = enabled;
  }
}

/*********************************************************************
 * UIServer
 * Main server-side script called when Custom UI client sends requests
 */
class UiServer extends HomebridgePluginUiServer {

  cloud;
  promiseSocket;
  security;
  logger;
  config;

  constructor() {
    super();
    // Obtain the plugin configuration from homebridge config JSON file.
    const config = require(this.homebridgeConfigPath).platforms.find((obj) => obj.platform === 'midea-platform');
    this.logger = new Logger(config?.uiDebug ? config.uiDebug : false);
    this.logger.info(`Custom UI created.`);
    this.logger.debug(`ENV:\n${JSON.stringify(process.env, null, 2)}`);
    this.security = new LocalSecurity();
    this.promiseSocket = new PromiseSocket(this.logger, config?.logRecoverableErrors ? config.logRecoverableErrors : false);

    this.onRequest('/login', async ({ username, password, registeredApp }) => {
      try {
        this.cloud = CloudFactory.createCloud(username, password, registeredApp);
        await this.cloud.login();
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
        this.logger.warn(`Login failed:\n${msg}`);
        throw new RequestError('Login failed, check credentials.');
      }
    });

    this.onRequest('/mergeToDefault', async ({ config }) => {
      _.defaultsDeep(config, defaultConfig);
      config.devices.forEach((device) => {
        _.defaultsDeep(device, defaultDeviceConfig);
      });
      this.config = config;
      this.logger.setDebugEnabled(config.uiDebug ? config.uiDebug : false);
      this.logger.debug(`Merged config:\n${JSON.stringify(config, null, 2)}`);
      return config;
    });

    this.onRequest('/getDefaults', async () => {
      return {
        defaultConfig,
        defaultDeviceConfig,
      };
    });

    this.onRequest('/discover', async () => {
      try {
        const devices = await this.blockingDiscover();
        for (const device of devices) {
          await this.getNewCredentials(device);
        }
        this.logger.debug(`All devices:\n${JSON.stringify(devices, null, 2)}`);
        return devices
          .filter((a) => Object.keys(a).length > 0)
          .sort((a, b) => a.ip.localeCompare(b.ip));
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
        throw new RequestError(`Device discovery failed:\n${msg}`);
      }
    });

    // inform client-side script that we are ready to receive requests.
    this.ready();
  }

  /*********************************************************************
   * getNewCredentials
   * Obtains token/key credentials and saves them in device object.
   */
  async getNewCredentials(device) {
    let connected = false;
    let i = 0;
    this.logger.info(`[${device.name}] Retrieve credentials.`);
    // Need to make two passes to obtain token/key credentials as they may work or not
    // depending on byte order (little or big-endian).  Exit the loop as soon as one
    // works or having tried both.
    while (i <= 1 && !connected) {
      // Start with big-endianess as it is more likely to succeed.
      const endianess = i === 0 ? 'big' : 'little';
      try {
        const [token, key] = await this.cloud.getToken(device.id, endianess);
        device.token = token ? token.toString('hex') : undefined;
        device.key = key ? key.toString('hex') : undefined;
        await this.authenticate(device);
        connected = true;
      } catch (e) {
        //const msg = e instanceof Error ? e.stack : e;
        this.logger.debug(`[${device.name}] Getting token and key with ${endianess}-endian is not successful.\n${e}`);
        // if failed then reset token/key
        device.token = undefined;
        device.key = undefined;
      }
      i++;
    }
    this.logger.debug(`[${device.name}] Token: ${device.token}, Key: ${device.key}`);
    return;
  }

  /*********************************************************************
   * authenticate
   * authenticate the token/key pair with the device to check that it works.
   */
  async authenticate(device) {
    if (!(device.token && device.key)) {
      throw new Error(`[${device.name}] Token or key is missing!`);
    }
    await this.promiseSocket.connect(device.port, device.ip);
    // Wrap next block in try/finally so we can destroy the socket if error occurs
    // let thrown errors cascade up.
    try {
      const request = this.security.encode_8370(Buffer.from(device.token, 'hex'), TCPMessageType.HANDSHAKE_REQUEST);
      await this.promiseSocket.write(request);
      const response = await this.promiseSocket.read();
      if (response) {
        if (response.length < 20) {
          this.logger.debug(`[${device.name}] Authenticate error when receiving data from ${device.ip}:${device.port}. (Data length: ${response.length})\n${JSON.stringify(response)}`);
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

  /*********************************************************************
   * blockingDiscover
   * broadcast to network(s) to discover new devices, obtain credentials
   * for each as discovered.
   */
  async blockingDiscover() {
    let devices = [];
    const discover = new Discover(this.logger);
    return new Promise((resolve, reject) => {
      this.logger.info('Start device discovery...');
      // If IP address is in config then probe them directly
      this.config.devices.forEach((device) => {
        // for some reason, assigning the regex has to be inside the loop, else fails after first pass.
        const regexIPv4 = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/gi;
        const ip = device.advanced_options?.ip?.toString().trim();
        if (regexIPv4.test(ip)) {
          discover.discoverDeviceByIP(ip);
        } else if (ip) {
          // Need to display warning to user interface as well.
          this.logger.warn(`[${device.name}] Invalid IP address in configuration: ${ip}`);
        }
      });
      // And then send broadcast to network(s)
      discover.startDiscover();
      discover.on('device', async (device) => {
        switch (device.type) {
          case DeviceType.AIR_CONDITIONER:
            device['displayName'] = 'Air Conditioner';
            break;
          case DeviceType.DEHUMIDIFIER:
            device['displayName'] = 'Dehumidifier';
            break;
          default:
            device['displayName'] = 'Unknown';
            break;
        }
        devices.push(device);
      });
      discover.on('complete', () => {
        this.logger.info('Device discovery complete.');
        resolve(devices);
      });
    });
  }
}

// start the instance of the class
(() => {
  return new UiServer();
})();
