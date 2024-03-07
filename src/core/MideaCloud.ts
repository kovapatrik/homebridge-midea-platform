/***********************************************************************
 * Midea Cloud access functions
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan and
 *                https://github.com/mill1000/midea-msmart
 *
 */
import axios from 'axios';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import { Semaphore } from 'semaphore-promise';
import { Endianness } from './MideaConstants';
import {
  ArtisonClimaSecurity,
  CloudSecurity,
  MeijuCloudSecurity,
  MSmartHomeCloudSecurity,
  NetHomePlusSecurity,
  ProxiedSecurity,
  SimpleSecurity,
} from './MideaSecurity';
import { numberToUint8Array } from './MideaUtils';

abstract class CloudBase<S extends CloudSecurity> {
  protected readonly CLIENT_TYPE = 1;
  protected readonly FORMAT = 2;
  protected readonly LANGUAGE = 'en_US';

  protected abstract readonly APP_ID: string;
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

  abstract buildRequestData(): { [key: string]: string | number };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract apiRequest(endpoint: string, data: { [key: string]: any }): Promise<any>;

  async getLoginId() {
    try {
      const response = await this.apiRequest('/v1/user/login/id/get', {
        ...this.buildRequestData(),
        loginAccount: this.account,
      });
      if (response) {
        return response['loginId'];
      }
    } catch (e) {
      const msg = e instanceof Error ? e.stack : e;
      throw new Error(`Failed to get login ID:\n${msg}`);
    }
  }

  abstract login(): Promise<void>;

  async getTokenKey(device_id: number, endianess: Endianness): Promise<[Buffer, Buffer]> {
    const udpid = CloudSecurity.getUDPID(numberToUint8Array(device_id, 6, endianess));
    const response = await this.apiRequest('/v1/iot/secure/getToken', {
      ...this.buildRequestData(),
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
}

abstract class ProxiedCloudBase<S extends ProxiedSecurity> extends CloudBase<S> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async apiRequest(endpoint: string, data: { [key: string]: any }) {
    const url = `${this.API_URL}${endpoint}`;
    const random = randomBytes(16).toString('hex');
    const sign = this.security.sign(JSON.stringify(data), random);
    const headers = {
      'Content-Type': 'application/json',
      secretVersion: '1',
      sign: sign,
      random: random,
    };
    if (this.uid) {
      headers['uid'] = this.uid;
    }
    if (this.access_token) {
      headers['accessToken'] = this.access_token;
    }

    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post(url, data, { headers: headers, timeout: 10000 });
        if (response.data['code'] !== undefined) {
          if (Number.parseInt(response.data['code']) === 0) {
            return response.data['data'];
          }
        }
        throw new Error(`Error response from API: ${JSON.stringify(response.data)}`);
      } catch (error) {
        throw new Error(`Error while sending request to ${url}: ${error}`);
      }
    }
    throw new Error(`Failed to send request to ${url}.`);
  }

  buildRequestData() {
    return {
      appId: this.APP_ID,
      format: this.FORMAT,
      clientType: this.CLIENT_TYPE,
      language: this.LANGUAGE,
      src: this.APP_ID,
      stamp: this.timestamp(),
      deviceId: this.DEVICE_ID,
      reqId: randomBytes(16).toString('hex'),
    };
  }

  async login() {
    const releaseSemaphore = await this.semaphore.acquire('Obtain login semaphore');
    try {
      if (this.loggedIn) {
        return;
      }
      // Not logged in so proceed...
      const login_id = await this.getLoginId();
      const iotData = this.buildRequestData();
      delete iotData['uid'];

      const response = await this.apiRequest('/mj/user/login', {
        data: {
          platform: this.FORMAT,
          deviceId: this.DEVICE_ID,
        },
        iotData: {
          appId: this.APP_ID,
          clientType: this.CLIENT_TYPE,
          iampwd: this.security.encrpytIAMPassword(login_id, this.password),
          loginAccount: this.account,
          password: this.security.encrpytPassword(login_id, this.password),
          pushToken: randomBytes(16).toString('base64url'),
          reqId: randomBytes(16).toString('hex'),
          src: this.APP_ID,
          stamp: this.timestamp(),
        },
      });

      if (response) {
        this.access_token = response['mdata']['accessToken'];
        if (response['key'] !== undefined) {
          this.key = response['key'];
        }
        this.loggedIn = true;
      } else {
        this.loggedIn = false;
        throw new Error('Failed to login.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.stack : e;
      throw new Error(`Error in Adding new accessory:\n${msg}`);
    } finally {
      releaseSemaphore();
    }
  }

  async getProtocolLua(deviceType: number, serialNumber: string) {
    const response = await this.apiRequest('/v2/luaEncryption/luaGet', {
      ...this.buildRequestData(),
      applianceMFCode: '0000',
      applianceSn: this.security.encryptAESAppKey(Buffer.from(serialNumber, 'utf8')).toString('hex'),
      applianceType: `0x${deviceType.toString(16).padStart(2, '0')}`,
      encryptedType: 2,
      version: '0',
    });

    if (response) {
      return response;
    } else {
      throw new Error('Failed to get protocol.');
    }
  }

  async getPlugin(deviceType: number, serialNumber: string) {
    const response = await this.apiRequest('/v1/plugin/update/overseas/get', {
      ...this.buildRequestData(),
      clientVersion: '0',
      uid: this.uid ?? randomBytes(16).toString('hex'),
      applianceList: [
        {
          appModel: serialNumber.substring(9, 17),
          appType: `0x${deviceType.toString(16).padStart(2, '0')}`,
          modelNumber: '0',
        },
      ],
    });

    if (response) {
      return response;
    } else {
      throw new Error('Failed to get plugin.');
    }
  }
}

class MSmartHomeCloud extends ProxiedCloudBase<MSmartHomeCloudSecurity> {
  protected readonly APP_ID = '1010';
  protected readonly API_URL = 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MSmartHomeCloudSecurity());
  }
}

class MeijuCloud extends ProxiedCloudBase<MeijuCloudSecurity> {
  protected readonly APP_ID = '1010';
  protected readonly API_URL = 'https://mp-prod.smartmidea.net/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MeijuCloudSecurity());
  }
}

abstract class SimpleCloud<T extends SimpleSecurity> extends CloudBase<T> {
  protected sessionId?: string;

  constructor(account: string, password: string, security: T) {
    super(account, password, security);
  }

  buildRequestData() {
    const data = {
      src: this.APP_ID,
      format: 2,
      stamp: this.timestamp(),
      devideId: this.DEVICE_ID,
      reqId: randomBytes(16).toString('hex'),
      clientType: 1,
      appId: this.APP_ID,
    };
    if (this.sessionId) {
      data['sessionId'] = this.sessionId;
    }
    return data;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async apiRequest(endpoint: string, data: { [key: string]: any }, header?: { [key: string]: any } | undefined) {
    const headers = {
      ...header,
    };
    if (data['reqId'] === undefined) {
      data['reqId'] = randomBytes(16).toString('hex');
    }
    if (data['stamp'] === undefined) {
      data['stamp'] = this.timestamp();
    }

    const url = `${this.API_URL}${endpoint}`;
    const queryParams = new URLSearchParams(data);
    queryParams.sort();
    data['sign'] = this.security.sign(url, queryParams.toString());

    if (this.uid) {
      headers['uid'] = this.uid;
    }
    if (this.access_token) {
      headers['accessToken'] = this.access_token;
    }

    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post(url, data, { headers: headers });
        if (
          response.data['errorCode'] !== undefined &&
          Number.parseInt(response.data['errorCode']) === 0 &&
          response.data['result'] !== undefined
        ) {
          return response.data['result'];
        }
      } catch (error) {
        throw new Error(`Error while sending request to ${url}: ${error}`);
      }
    }
    throw new Error(`Failed to send request to ${url}.`);
  }

  async login() {
    // We need to protect against multiple attempts to login, so we only login if not already
    // logged in.  Protect this block with a semaphone.
    const releaseSemaphore = await this.semaphore.acquire('Obtain login semaphore');
    try {
      if (this.loggedIn) {
        return;
      }
      // Not logged in so proceed...
      const login_id = await this.getLoginId();
      const data = {
        ...this.buildRequestData(),
        loginAccount: this.account,
        password: this.security.encrpytPassword(login_id, this.password),
      };
      if (this.sessionId) {
        data['sessionId'] = this.sessionId;
      }
      const response = await this.apiRequest('/v1/user/login', data);
      if (response) {
        this.access_token = response['accessToken'];
        this.sessionId = response['sessionId'];
        this.uid = response['userId'];
        this.loggedIn = true;
      } else {
        this.loggedIn = false;
        throw new Error('Failed to login.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.stack : e;
      throw new Error(`Error in Adding new accessory:\n${msg}`);
    } finally {
      releaseSemaphore();
    }
  }
}

class NetHomePlusCloud extends SimpleCloud<NetHomePlusSecurity> {
  protected readonly APP_ID = '1017';
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new NetHomePlusSecurity());
  }
}

class AristonClimaCloud extends SimpleCloud<ArtisonClimaSecurity> {
  protected readonly APP_ID = '1005';
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new ArtisonClimaSecurity());
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
      case 'Ariston Clima':
        return new AristonClimaCloud(account, password);
      default:
        throw new Error(`Cloud ${cloud} is not supported.`);
    }
  }
}
