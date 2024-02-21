/***********************************************************************
 * Midea Cloud access functions
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import axios from 'axios';
import { CloudSecurity, MeijuCloudSecurity, NetHomePlusSecurity, MideaAirSecurity } from './MideaSecurity';
import { numberToUint8Array } from './MideaUtils';
import { DeviceType, Endianness } from './MideaConstants';
import { Semaphore } from 'semaphore-promise';

abstract class CloudBase<S extends CloudSecurity> {
  protected readonly LANGUAGE = 'en_US';

  protected abstract readonly APP_ID: string;
  protected abstract readonly APP_KEY: string;
  protected abstract readonly API_URL: string;
  protected readonly DEVICE_ID = randomBytes(8).toString('hex');

  protected access_token?: string;
  protected uid?: string;
  protected key?: string;

  protected semaphore: Semaphore;
  public loggedIn = false;

  constructor(
    protected readonly account: string,
    protected readonly password: string,
    protected readonly security: S,
  ) {
    // Required to serialize access to some cloud functions.
    this.semaphore = new Semaphore();
  }

  protected timestamp() {
    return DateTime.now().toFormat('yyyyMMddHHmmss');
  }

  async apiRequest(
    endpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { [key: string]: any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    header?: { [key: string]: any },
  ) {
    if (data['reqId'] === undefined) {
      data['reqId'] = randomBytes(16).toString('hex');
    }
    if (data['stamp'] === undefined) {
      data['stamp'] = this.timestamp();
    }

    const url = `${this.API_URL}${endpoint}`;
    const random = randomBytes(16).toString('hex');

    const sign = this.security.sign(JSON.stringify(data), random);
    const headers = {
      ...header,
      'Content-Type': 'application/json',
      secretVersion: '1',
      sign: sign,
      random: random,
      accessToken: this.access_token,
      uid: this.uid,
    };

    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post(url, data, { headers: headers });
        if (Number.parseInt(response.data['code']) === 0) {
          return response.data['data'];
        } else {
          throw new Error(`Error while sending request to ${url}: ${JSON.stringify(response.data)}`);
        }
      } catch (error) {
        throw new Error(`Error while sending request to ${url}: ${error}`);
      }
    }
    throw new Error(`Failed to send request to ${url}.`);
  }

  async getLoginId() {
    const response = await this.apiRequest('/v1/user/login/id/get', {
      loginAccount: this.account,
    });

    if (response) {
      // this.logger.info('Logged in to Midea Cloud.');
      return response['loginId'];
    }

    throw new Error('Failed to get login ID.');
  }

  abstract login(): Promise<void>;

  //   // We need to protect against multiple attempts to login, so we only login if not already
  //   // logged in.  Protect this block with a semaphone.
  //   const releaseSemaphore = await this.semaphore.acquire('Obtain login semaphore');
  //   try {
  //     if (this.loggedIn) {
  //       return;
  //     }
  //     // Not logged in so proceed...
  //     const login_id = await this.getLoginId();
  //     const response = await this.apiRequest('/mj/user/login', {
  //       data: {
  //         appKey: this.APP_KEY,
  //         platform: this.FORMAT,
  //         deviceId: this.DEVICE_ID,
  //       },
  //       iotData: {
  //         appId: this.APP_ID,
  //         clientType: this.CLIENT_TYPE,
  //         iampwd: this.security.encrpytIAMPassword(login_id, this.password),
  //         loginAccount: this.account,
  //         password: this.security.encrpytPassword(login_id, this.password),
  //         pushToken: randomBytes(20).toString('base64url'),
  //         reqId: randomBytes(16).toString('hex'),
  //         src: this.SRC,
  //         stamp: this.timestamp(),
  //       },
  //     });
  //     if (response) {
  //       this.access_token = response['mdata']['accessToken'];
  //       if (response['key'] !== undefined) {
  //         this.key = response['key'];
  //       }
  //       this.loggedIn = true;
  //     } else {
  //       this.loggedIn = false;
  //       throw new Error('Failed to login.');
  //     }
  //   } catch (e) {
  //     const msg = e instanceof Error ? e.stack : e;
  //     throw new Error(`Error in Adding new accessory:\n${msg}`);
  //   } finally {
  //     releaseSemaphore();
  //   }
  // }

  async getTokenKey(device_id: number, endianess: Endianness): Promise<[Buffer, Buffer]> {
    const udpid = CloudSecurity.getUDPID(numberToUint8Array(device_id, 6, endianess));
    const response = await this.apiRequest('/v1/iot/secure/getToken', {
      udpid: udpid,
    });

    if (response) {
      for (const token of response['tokenlist']) {
        if (token['udpId'] === udpid) {
          return [Buffer.from(token['token'], 'hex'), Buffer.from(token['key'], 'hex')];
        }
      }
    } else {
      throw new Error('Failed to get token.');
    }

    throw new Error(`No token/key found for udpid ${udpid}.`);
  }

  abstract listHome(): Promise<void>;
  abstract listDevices(home_id?: number): Promise<{ [key: string]: never }>;

  async getDeviceInfo(device_id: number) {
    try {
      const response = await this.listDevices();
      if (response && Object.keys(response).includes(device_id.toString())) {
        return response[device_id];
      }
      return undefined;
    } catch (e) {
      throw new Error(`Error in getDeviceInfo: ${e}`);
    }
  }

  abstract downloadLua(device_type: DeviceType, serial_number: string, model_number?: string, manufacturer_code?: string): Promise<void>;
}

class MSmartHomeCloud extends CloudBase<MeijuCloudSecurity> {
  protected readonly APP_ID = '1010';
  protected readonly APP_KEY = 'ac21b9f9cbfe4ca5a88562ef25e2b768';
  protected readonly API_URL = 'https://mp-prod.smartmidea.net/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MeijuCloudSecurity());
  }
}

class MeijuCloud extends CloudBase<MeijuCloudSecurity> {
  protected readonly APP_ID = '900';
  protected readonly APP_KEY = '46579c15';
  protected readonly API_URL = 'https://mp-prod.smartmidea.net/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MeijuCloudSecurity());
  }
}

class NetHomePlusCloud extends CloudBase<NetHomePlusSecurity> {
  protected readonly APP_ID = '1017';
  protected readonly APP_KEY = '3742e9e5842d4ad59c2db887e12449f9';
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new NetHomePlusSecurity());
  }
}

class MideaAirCloud extends CloudBase<MideaAirSecurity> {
  protected readonly APP_ID = '1117';
  protected readonly APP_KEY = 'ff0cf6f5f0c3471de36341cab3f7a9af';
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new MideaAirSecurity());
  }
}

class AristonClimaCloud extends CloudBase<MideaAirSecurity> {
  protected readonly APP_ID = '1005';
  protected readonly APP_KEY = '434a209a5ce141c3b726de067835d7f0';
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new MideaAirSecurity());
  }
}

export default class CloudFactory {
  static createCloud(account: string, password: string, cloud: string): CloudBase<CloudSecurity> {
    switch (cloud) {
      case 'Midea SmartHome (MSmartHome)':
        return new MSmartHomeCloud(account, password);
      case 'Meiju':
        return new MeijuCloud(account, password);
      case 'NetHome Plus':
        return new NetHomePlusCloud(account, password);
      case 'Midea Air':
        return new MideaAirCloud(account, password);
      case 'Ariston Clima':
        return new AristonClimaCloud(account, password);
      default:
        throw new Error(`Cloud ${cloud} is not supported.`);
    }
  }
}
