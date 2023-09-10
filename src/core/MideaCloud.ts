import { Logger } from 'homebridge';

import { randomBytes } from 'crypto';
import { DateTime } from 'luxon';
import axios from 'axios';
import { CloudSecurity } from './MideaSecurity';
import { numberToUint8Array } from './MideaUtils';
import { Endianness } from './MideaConstants';

export default class Cloud {

  // Misc constants for the API
  private readonly CLIENT_TYPE = 1;
  private readonly FORMAT = 2;
  private readonly LANGUAGE = 'en_US';
  private readonly APP_ID = '1010';
  private readonly SRC = '1010';
  private readonly DEVICE_ID = randomBytes(8).toString('hex');

  // Base URLs
  BASE_URL = 'https://mp-prod.appsmb.com';
  BASE_URL_CHINA = 'https://mp-prod.smartmidea.net';

  // Default number of request retries
  RETRIES = 3;

  // Attributes that holds the login information of the current user
  private loginId?: string;
  private accessToken: string;
  private session?: object;

  private base_url: string;

  private security: CloudSecurity;

  constructor(
    private readonly account: string,
    private readonly password: string,
    use_china_server = false,
    private readonly logger: Logger,
  ) {

    this.accessToken = '';

    this.security = new CloudSecurity(use_china_server);

    if (use_china_server) {
      this.base_url = this.BASE_URL_CHINA;
    } else {
      this.base_url = this.BASE_URL;
    }

    this.logger.debug(`Using Midea cloud server: ${this.base_url} (China: ${use_china_server}).`);
  }

  private timestamp() {
    return DateTime.utc().toFormat('yyyyMMddHHmmss');
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private parseResponse(response: any) {
    this.logger.debug(`Parsing response: ${JSON.stringify(response)}`);

    if (response.code === '0' || response.code === 0) {
      return response.data;
    }

    throw new Error(`Error response from Midea cloud: ${response.msg}`);
  }

  private async request(url: string, headers: object, data: object, retries: number = this.RETRIES) {

    this.logger.debug(`Sending request to ${url} with data: ${JSON.stringify(data)}`);

    try {
      const response = await axios.post(url, data, { headers: headers });
      return this.parseResponse(response.data);
    } catch (error) {
      this.logger.error(`Error while sending request to ${url}: ${error}`);

      if (retries > 0) {
        this.logger.debug(`Retrying request to ${url} (${retries} retries left).`);
        return this.request(url, headers, data, retries - 1);
      }

      throw error;
    }
  }

  private async apiRequest(endpoint: string, body: object) {

    const data = JSON.stringify(body);
    const random = randomBytes(16).toString('hex');

    const sign = this.security.sign(data, random);

    const headers = {
      'Content-Type': 'application/json',
      'secretVersion': '1',
      'sign': sign,
      'random': random,
      'accessToken': this.accessToken,
    };

    const url = `${this.base_url}/mas/v5/app/proxy?alias=${endpoint}`;

    return await this.request(url, headers, body);
  }

  private buildRequestBody(data: object) {
    const body = {
      'appId': this.APP_ID,
      'format': this.FORMAT,
      'clientType': this.CLIENT_TYPE,
      'language': this.LANGUAGE,
      'src': this.SRC,
      'stamp': this.timestamp(),
      'deviceId': this.DEVICE_ID,
      'reqId': randomBytes(16).toString('hex'),
    };

    return Object.assign(body, data);
  }

  private async getLoginId() {
    const response = await this.apiRequest('/v1/user/login/id/get',
      this.buildRequestBody({
        'loginAccount': this.account,
      }));
    if (response) {
      return response['loginId'];
    }

    throw new Error('Failed to get login ID.');
  }

  public async login(force = false) {
    if (this.session && !force) {
      return;
    }

    if (this.loginId === undefined) {
      this.loginId = await this.getLoginId();
      this.logger.debug(`Got login ID: ${this.loginId}`);
    }

    const body = {
      'data': {
        'platform': this.FORMAT,
        'deviceId': this.DEVICE_ID,
      },
      'iotData': {
        'appId': this.APP_ID,
        'clientType': this.CLIENT_TYPE,
        'iampwd': this.security.encrpytIAMPassword(this.loginId!, this.password),
        'loginAccount': this.account,
        'password': this.security.encrpytPassword(this.loginId!, this.password),
        'pushToken': randomBytes(20).toString('base64url'),
        'reqId': randomBytes(16).toString('hex'),
        'src': this.SRC,
        'stamp': this.timestamp(),
      },
    };

    const response = await this.apiRequest('/mj/user/login', body);

    if (response) {
      this.accessToken = response['mdata']['accessToken'];
      this.session = response;
      this.logger.debug(`Logged in with access token: ${this.accessToken}`);
    } else {
      throw new Error('Failed to login.');
    }
  }

  public async getToken(device_id: number, endianess: Endianness): Promise<[Buffer, Buffer]> {

    const udpid = CloudSecurity.getUDPID(numberToUint8Array(device_id, 6, endianess));
    const response = await this.apiRequest('/v1/iot/secure/getToken',
      this.buildRequestBody({ 'udpid': udpid }),
    );

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