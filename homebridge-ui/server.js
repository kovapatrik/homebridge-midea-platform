const { HomebridgePluginUiServer, RequestError } = require('@homebridge/plugin-ui-utils');
const Discover = require('../dist/core/MideaDiscover.js').default;
const CloudFactory = require('../dist/core/MideaCloud.js').default;
const { DeviceType, TCPMessageType } = require("../dist/core/MideaConstants.js");
const { LocalSecurity } = require("../dist/core/MideaSecurity.js");
const { PromiseSocket } = require("../dist/core/MideaUtils.js");
const { defaultConfig, defaultDeviceConfig } = require('../dist/platformUtils.js');

var _ = require('lodash');

class UiServer extends HomebridgePluginUiServer {

  cloud;
  promiseSocket;
  security;

  constructor() {
    super();

    this.security = new LocalSecurity();
    this.promiseSocket = new PromiseSocket();

    this.onRequest('/login', async ({ username, password, registeredApp }) => {
      try {
        this.cloud = CloudFactory.createCloud(username, password, registeredApp);
        await this.cloud.login();
      } catch (error) {
        throw new RequestError(`Login failed: ${error.message}`);
      }
    });

    this.onRequest('/mergeToDefault', async ({ config }) => {
      _.defaultsDeep(config, defaultConfig);
      config.devices.forEach((device) => {
        _.defaultsDeep(device, defaultDeviceConfig);
      });
      return config;
    });

    this.onRequest('/getDefaults', async () => {
      return {
        defaultConfig,
        defaultDeviceConfig,
      }
    });

    this.onRequest('/discover', async () => {
      const devices = await this.blockingDiscover();
      const response = await Promise.all(devices.map(async (device) => {
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
        const [token, key] = await this.getNewCredentials(device);
        device['token'] = token ? token.toString('hex') : undefined;
        device['key'] = key ? key.toString('hex') : undefined;
        return device;
      }));
      return response
              .filter((a) => Object.keys(a).length > 0)
              .sort((a, b) => a.ip.localeCompare(b.ip));
    });

    this.ready();
  }

  
  async getNewCredentials(device) {
    let connected = false;
    let i = 0;
    let token = undefined;
    let key = undefined;
    // Need to make two passes to obtain token/key credentials as they may work or not
    // depending on byte order (little or big-endian).  Exit the loop as soon as one
    // works or having tried both.
    while (i <= 1 && !connected) {
      const endianess = i === 0 ? 'little' : 'big';
      try {
        [token, key] = await this.cloud.getToken(device.id, endianess);
        await this.authenticate(device);
        connected = true;
      } catch (e) {
        const msg = e instanceof Error ? e.stack : e;
        console.warn(`Getting token and key with ${endianess}-endian is not successful:\n${msg}`);
      }
      i++;
    }
    return [token, key];
  }

  async authenticate(device) {
    if (!(device.token && device.key)) {
      throw new Error('Token or key is missing!');
    }

    await this.promiseSocket.connect(device.ip, device.port);
    const request = this.security.encode_8370(token, TCPMessageType.HANDSHAKE_REQUEST);
    await this.promiseSocket.write(request);
    const response = await this.promiseSocket.read();

    if (response) {
      if (response.length < 20) {
        this.promiseSocket.destroy();
        throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}. (Data length mismatch)`);
      }
      const resp = response.subarray(8, 72);
      this.security.tcp_key_from_resp(resp, this.key);
    } else {
      this.promiseSocket.destroy();
      throw Error(`Authenticate error when receiving data from ${this.ip}:${this.port}.`);
    }
    this.promiseSocket.destroy();
  }

  async blockingDiscover() {
    let devices = [];
    const discover = new Discover();
    return new Promise((resolve, reject) => {
      discover.startDiscover();
      discover.on('device', (device) => {
        devices.push(device);
      });
      discover.on('complete', () => {
        resolve(devices);
      })
    });
  }
}

// start the instance of the class
(() => {
  return new UiServer();
})();
