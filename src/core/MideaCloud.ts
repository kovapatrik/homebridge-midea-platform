/***********************************************************************
 * Midea Cloud access functions
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 * Portions Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import axios from 'axios';
import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import { Semaphore } from 'semaphore-promise';
import { Endianness } from './MideaConstants';
import { CloudSecurity, MeijuCloudSecurity, MSmartHomeCloudSecurity, SimpleSecurity } from './MideaSecurity';
import { numberToUint8Array } from './MideaUtils';

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  abstract makeGeneralData(): { [key: string]: any };

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
      'Content-Type': 'application/json; charset=utf-8',
      secretVersion: '1',
      sign: sign,
      random: random,
    };

    if (this.uid) {
      headers['uid'] = this.uid;
    }
    if (this.access_token) {
      headers['access_token'] = this.access_token;
    }

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
    try {
      const response = await this.apiRequest('/v1/user/login/id/get', {
        ...this.makeGeneralData(),
        loginAccount: this.account,
      });
      if (response) {
        // this.logger.info('Logged in to Midea Cloud.');
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
      ...this.makeGeneralData(),
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

class MSmartHomeCloud extends CloudBase<MSmartHomeCloudSecurity> {
  protected readonly APP_ID = '1010';
  protected static readonly APP_KEY = 'ac21b9f9cbfe4ca5a88562ef25e2b768';
  protected readonly APP_KEY = MSmartHomeCloud.APP_KEY;
  protected readonly API_URL = 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MSmartHomeCloudSecurity(MSmartHomeCloud.APP_KEY));
  }

  makeGeneralData() {
    return {
      src: this.APP_ID,
      format: 2,
      stamp: this.timestamp(),
      platformId: 1,
      devideId: this.DEVICE_ID,
      reqId: randomBytes(16).toString('hex'),
      uid: this.uid,
      clientType: 1,
      appId: this.APP_ID,
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
      const iotData = this.makeGeneralData();
      delete iotData['uid'];

      const response = await this.apiRequest('/mj/user/login', {
        data: {
          appKey: this.APP_KEY,
          platform: 2,
          deviceId: this.DEVICE_ID,
        },
        iotData: {
          ...iotData,
          iampwd: this.security.encrpytIAMPassword(login_id, this.password),
          loginAccount: this.account,
          password: this.security.encrpytPassword(login_id, this.password),
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
}

class MeijuCloud extends CloudBase<MeijuCloudSecurity> {
  protected readonly APP_ID = '900';
  protected static readonly LOGIN_KEY = 'ad0ee21d48a64bf49f4fb583ab76e799';
  protected readonly APP_KEY = '46579c15';
  protected readonly API_URL = 'https://mp-prod.smartmidea.net/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MeijuCloudSecurity(MeijuCloud.LOGIN_KEY));
  }

  makeGeneralData() {
    return {};
  }

  async login() {
    const releaseSemaphore = await this.semaphore.acquire('Obtain login semaphore');
    try {
      if (this.loggedIn) {
        return;
      }
      // Not logged in so proceed...
      const login_id = await this.getLoginId();
      const stamp = this.timestamp();
      const response = await this.apiRequest('/mj/user/login', {
        data: {
          appKey: this.APP_KEY,
          platform: 2,
          deviceId: this.DEVICE_ID,
        },
        iotData: {
          clientType: 1,
          devideId: this.DEVICE_ID,
          iampwd: this.security.encrpytIAMPassword(login_id, this.password),
          iotAppId: this.APP_ID,
          loginAccount: this.account,
          password: this.security.encrpytPassword(login_id, this.password),
          reqId: randomBytes(16).toString('hex'),
          stamp: stamp,
        },
        timestamp: stamp,
        stamp: stamp,
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
}

abstract class SimpleCloud<T extends SimpleSecurity> extends CloudBase<T> {
  protected sessionId?: string;

  constructor(account: string, password: string, security: T) {
    super(account, password, security);
  }

  makeGeneralData() {
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
        ...this.makeGeneralData(),
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

class NetHomePlusCloud extends SimpleCloud<SimpleSecurity> {
  protected readonly APP_ID = '1017';
  protected static readonly APP_KEY = '3742e9e5842d4ad59c2db887e12449f9';
  protected readonly APP_KEY = NetHomePlusCloud.APP_KEY;
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new SimpleSecurity(NetHomePlusCloud.APP_KEY));
  }
}

class MideaAirCloud extends SimpleCloud<SimpleSecurity> {
  protected readonly APP_ID = '1117';
  protected static readonly APP_KEY = 'ff0cf6f5f0c3471de36341cab3f7a9af';
  protected readonly APP_KEY = MideaAirCloud.APP_KEY;
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new SimpleSecurity(MideaAirCloud.APP_KEY));
  }
}

class AristonClimaCloud extends SimpleCloud<SimpleSecurity> {
  protected readonly APP_ID = '1005';
  protected static readonly APP_KEY = '434a209a5ce141c3b726de067835d7f0';
  protected readonly APP_KEY = AristonClimaCloud.APP_KEY;
  protected readonly API_URL = 'https://mapp.appsmb.com';

  constructor(account: string, password: string) {
    super(account, password, new SimpleSecurity(AristonClimaCloud.APP_KEY));
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
