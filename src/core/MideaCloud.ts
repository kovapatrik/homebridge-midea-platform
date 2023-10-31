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
import { Endianness } from './MideaConstants';
import { Semaphore } from 'semaphore-promise';

abstract class CloudBase<T extends CloudSecurity> {
  protected readonly CLIENT_TYPE = 1;
  protected readonly FORMAT = 2;
  protected readonly APP_KEY = '4675636b';

  protected readonly LANGUAGE = 'en_US';
  protected readonly APP_ID: string = '1010';
  protected readonly SRC: string = '1010';
  protected readonly DEVICE_ID = randomBytes(8).toString('hex');

  protected abstract API_URL: string;
  protected access_token?: string;
  protected key?: string;

  protected semaphore: Semaphore;
  protected loggedIn = false;

  constructor(
    protected readonly account: string,
    protected readonly password: string,
    protected readonly security: T,
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
    args?: { [key: string]: any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: { [key: string]: any },
  ) {
    if (data === undefined) {
      data = {
        appId: this.APP_ID,
        format: this.FORMAT,
        clientType: this.CLIENT_TYPE,
        language: this.LANGUAGE,
        src: this.SRC,
        stamp: this.timestamp(),
        deviceId: this.DEVICE_ID,
      };
    }
    data = { ...data, ...args };

    if (data['reqId'] === undefined) {
      data['reqId'] = randomBytes(16).toString('hex');
    }

    const url = `${this.API_URL}${endpoint}`;
    const random = randomBytes(16).toString('hex');

    const sign = this.security.sign(JSON.stringify(data), random);
    const headers = {
      'Content-Type': 'application/json',
      secretVersion: '1',
      sign: sign,
      random: random,
      accessToken: this.access_token,
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
      const response = await this.apiRequest('/mj/user/login', {
        data: {
          appKey: this.APP_KEY,
          platform: this.FORMAT,
          deviceId: this.DEVICE_ID,
        },
        iotData: {
          appId: this.APP_ID,
          clientType: this.CLIENT_TYPE,
          iampwd: this.security.encrpytIAMPassword(login_id, this.password),
          loginAccount: this.account,
          password: this.security.encrpytPassword(login_id, this.password),
          pushToken: randomBytes(20).toString('base64url'),
          reqId: randomBytes(16).toString('hex'),
          src: this.SRC,
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

  async getToken(device_id: number, endianess: Endianness): Promise<[Buffer, Buffer]> {
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
}

class MSmartHomeCloud extends CloudBase<CloudSecurity> {
  protected API_URL = 'https://mp-prod.appsmb.com/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new CloudSecurity('ac21b9f9cbfe4ca5a88562ef25e2b768', 'meicloud'));
  }
}

class MeijuCloud extends CloudBase<MeijuCloudSecurity> {
  protected API_URL = 'https://mp-prod.smartmidea.net/mas/v5/app/proxy?alias=';

  constructor(account: string, password: string) {
    super(account, password, new MeijuCloudSecurity('ad0ee21d48a64bf49f4fb583ab76e799', 'prod_secret123@muc'));
  }
}

class UnProxiedCloudBase<T extends CloudSecurity> extends CloudBase<T> {
  protected API_URL = 'https://mapp.appsmb.com';

  protected sessionId?: string;

  constructor(account: string, password: string, security: T) {
    super(account, password, security);
  }

  async apiRequest(
    endpoint: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args?: { [key: string]: any },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: { [key: string]: any },
  ) {
    if (data === undefined) {
      data = {
        appId: this.APP_ID,
        format: this.FORMAT,
        clientType: this.CLIENT_TYPE,
        language: this.LANGUAGE,
        src: this.SRC,
        stamp: this.timestamp(),
      };
    }
    data = { ...data, ...args };
    if (this.sessionId) {
      data['sessionId'] = this.sessionId;
    }

    const url = `${this.API_URL}${endpoint}`;
    const queryParams = new URLSearchParams(data);
    queryParams.sort();
    data['sign'] = this.security.sign(url, queryParams.toString());

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };

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
      const response = await this.apiRequest('/v1/user/login', {
        loginAccount: this.account,
        password: this.security.encrpytPassword(login_id, this.password),
      });
      if (response) {
        this.access_token = response['accessToken'];
        this.sessionId = response['sessionId'];
      } else {
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

class NetHomePlusCloud extends UnProxiedCloudBase<NetHomePlusSecurity> {
  protected APP_ID = '1017';
  protected SRC = '1017';

  constructor(account: string, password: string) {
    super(account, password, new NetHomePlusSecurity('3742e9e5842d4ad59c2db887e12449f9'));
  }
}

class MideaAirCloud extends UnProxiedCloudBase<MideaAirSecurity> {
  protected APP_ID = '1117';
  protected SRC = '17';

  constructor(account: string, password: string) {
    super(account, password, new MideaAirSecurity('ff0cf6f5f0c3471de36341cab3f7a9af'));
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
      default:
        throw new Error(`Cloud ${cloud} is not supported.`);
    }
  }
}
