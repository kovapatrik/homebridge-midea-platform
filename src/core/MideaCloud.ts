import { Logger } from 'homebridge';

import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import axios from 'axios';
import { CloudSecurity, MeijuCloudSecurity, MideaAirSecurity } from './MideaSecurity';
import { numberToUint8Array } from './MideaUtils';
import { Endianness } from './MideaConstants';

export abstract class CloudBase<T extends CloudSecurity> {
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


  constructor(
    protected readonly account: string,
    protected readonly password: string,
    protected readonly logger: Logger,
    protected readonly security: T,
  ) { }

  protected timestamp() {
    return DateTime.utc().toFormat('yyyyMMddHHmmss');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async apiRequest(endpoint: string, args?: {[key: string]: any}, data?: {[key: string]: any}) {
    if (data === undefined) {
      data = {
        'appId': this.APP_ID,
        'format': this.FORMAT,
        'clientType': this.CLIENT_TYPE,
        'language': this.LANGUAGE,
        'src': this.SRC,
        'stamp': this.timestamp(),
        'deviceId': this.DEVICE_ID,
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
      'secretVersion': '1',
      'sign': sign,
      'random': random,
      'accessToken': this.access_token,
    };

    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post(url, data, { headers: headers });
        if (Number.parseInt(response.data['code']) === 0) {
          return response.data['data'];
        } else {
          this.logger.error(`Error while sending request to ${url}: ${JSON.stringify(response.data)}`);
        }
      } catch (error) {
        this.logger.error(`Error while sending request to ${url}: ${error}`);
      }
    }

    throw new Error(`Failed to send request to ${url}.`);
  }

  async getLoginId() {
    const response = await this.apiRequest('/v1/user/login/id/get', {
      'loginAccount': this.account,
    });

    if (response) {
      return response['loginId'];
    }

    throw new Error('Failed to get login ID.');
  }

  async login() {
    const login_id = await this.getLoginId();
    const response = await this.apiRequest('/mj/user/login', {
      'data': {
        'appKey': this.APP_KEY,
        'platform': this.FORMAT,
        'deviceId': this.DEVICE_ID,
      },
      'iotData': {
        'appId': this.APP_ID,
        'clientType': this.CLIENT_TYPE,
        'iampwd': this.security.encrpytIAMPassword(login_id, this.password),
        'loginAccount': this.account,
        'password': this.security.encrpytPassword(login_id, this.password),
        'pushToken': randomBytes(20).toString('base64url'),
        'reqId': randomBytes(16).toString('hex'),
        'src': this.SRC,
        'stamp': this.timestamp(),
      },
    });
    if (response) {
      this.access_token = response['mdata']['accessToken'];
      if (response['key'] !== undefined) {
        this.key = response['key'];
      }
    } else {
      throw new Error('Failed to login.');
    }
  }

  async getToken(device_id: number, endianess: Endianness): Promise<[Buffer, Buffer]> {
    const udpid = CloudSecurity.getUDPID(numberToUint8Array(device_id, 6, endianess));
    const response = await this.apiRequest('/v1/iot/secure/getToken', {
      'udpid': udpid,
    });

    if (response) {
      for (const token of response['tokenlist']) {
        if (token['udpId'] === udpid) {
          return [ Buffer.from(token['token'], 'hex'), Buffer.from(token['key'], 'hex') ];
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

  constructor(
    account: string,
    password: string,
    logger: Logger,
  ) {
    super(account, password, logger, new CloudSecurity('ac21b9f9cbfe4ca5a88562ef25e2b768', 'meicloud'));
  }
}

class MeijuCloud extends CloudBase<MeijuCloudSecurity> {
  protected API_URL = 'https://mp-prod.smartmidea.net/mas/v5/app/proxy?alias=';

  constructor(
    account: string,
    password: string,
    logger: Logger,
  ) {
    super(account, password, logger, new MeijuCloudSecurity('ad0ee21d48a64bf49f4fb583ab76e799', 'prod_secret123@muc'));
  }
}

class NetHomePlusCloud extends CloudBase<CloudSecurity> {
  protected API_URL = 'https://mapp.appsmb.com';
  protected APP_ID = '1017';
  protected SRC = '1017';

  constructor(
    account: string,
    password: string,
    logger: Logger,
  ) {
    super(account, password, logger, new CloudSecurity('xhdiwjnchekd4d512chdjx5d8e4c394D2D7S'));
  }
}

class MideaAirCloud extends CloudBase<MideaAirSecurity> {
  protected API_URL = 'https://mapp.appsmb.com';
  protected APP_ID = '1117';
  protected SRC = '17';

  private sessionId?: string;

  constructor(
    account: string,
    password: string,
    logger: Logger,
  ) {
    super(account, password, logger, new MideaAirSecurity('ff0cf6f5f0c3471de36341cab3f7a9af', undefined));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async apiRequest(endpoint: string, args?: {[key: string]: any}, data?: {[key: string]: any}) {
    if (data === undefined) {
      data = {
        'appId': this.APP_ID,
        'format': this.FORMAT,
        'clientType': this.CLIENT_TYPE,
        'language': this.LANGUAGE,
        'src': this.SRC,
        'stamp': this.timestamp(),
      };
    }
    data = { ...data, ...args };
    if (this.sessionId) {
      data['sessionId'] = this.sessionId;
    }

    const url = `${this.API_URL}${endpoint}`;
    const queryParams = new URLSearchParams(data);
    data['sign'] = this.security.sign(url, queryParams.toString());

    for (let i = 0; i < 3; i++) {
      try {
        const response = await axios.post(url, data);
        if (response.data['errorCode'] !== undefined && Number.parseInt(response.data['errorCode']) !== 0 &&
            response.data['result'] !== undefined) {
          return response.data['result'];
        }
      } catch (error) {
        this.logger.error(`Error while sending request to ${url}: ${error}`);
      }
    }
    throw new Error(`Failed to send request to ${url}.`);
  }

  async login() {
    const login_id = await this.getLoginId();
    const response = await this.apiRequest('/v1/user/login', {
      'loginAccount': this.account,
      'password': this.security.encrpytPassword(login_id, this.password),
    });
    if (response) {
      this.access_token = response['accessToken'];
      this.sessionId = response['sessionId'];
    } else {
      throw new Error('Failed to login.');
    }
  }
}

export default class CloudFactory {
  static createCloud(
    account: string,
    password: string,
    logger: Logger,
    cloud: string,
  ): CloudBase<CloudSecurity> {
    switch (cloud) {
      case 'Midea SmartHome (MSmartHome)':
        return new MSmartHomeCloud(account, password, logger);
      case 'Meiju':
        return new MeijuCloud(account, password, logger);
      case 'NetHome Plus':
        return new NetHomePlusCloud(account, password, logger);
      case 'Midea Air':
        return new MideaAirCloud(account, password, logger);
      default:
        throw new Error(`Cloud ${cloud} is not supported.`);
    }
  }
}