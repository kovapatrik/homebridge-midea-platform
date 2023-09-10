import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { TCPMessageType } from './MideaConstants';
import { numberToUint8Array, strxor } from './MideaUtils';

export type KeyToken = Buffer | undefined;

export class CloudSecurity {
  private readonly HMAC_KEY = 'PROD_VnoClJI9aikS8dyy';

  private readonly IOT_KEY = 'meicloud';
  private readonly LOGIN_KEY = 'ac21b9f9cbfe4ca5a88562ef25e2b768';

  private readonly IOT_KEY_CHINA = 'prod_secret123@muc';
  private readonly LOGIN_KEY_CHINA = 'ad0ee21d48a64bf49f4fb583ab76e799';

  private iot_key = this.use_china_server ? this.IOT_KEY_CHINA : this.IOT_KEY;
  private login_key = this.use_china_server ? this.LOGIN_KEY_CHINA : this.LOGIN_KEY;

  constructor(
    private readonly use_china_server: boolean = false,
  ) { }

  // Generate a HMAC signature for the provided data and random data.
  public sign(data: string, random: string) {
    const message = `${this.iot_key}${data}${random}`;
    return createHmac('sha256', this.HMAC_KEY).update(message).digest('hex');
  }

  // Encrypt the password for cloud API password.
  public encrpytPassword(loginId: string, password: string) {
    const m1 = createHash('sha256').update(password);

    const login_hash = `${loginId}${m1.digest('hex')}${this.login_key}`;
    const m2 = createHash('sha256').update(login_hash);

    return m2.digest('hex');
  }

  // Encrypts password for cloud API iampwd field.
  public encrpytIAMPassword(loginId: string, password: string) {
    const m1 = createHash('md5').update(password);

    const m2 = createHash('md5').update(m1.digest('hex'));

    if (this.use_china_server) {
      return m2.digest('hex');
    }

    const login_hash = `${loginId}${m2.digest('hex')}${this.login_key}`;
    const sha = createHash('sha256').update(login_hash);

    return sha.digest('hex');
  }

  public static getUDPID(device_id_buf: Uint8Array) {
    const data = createHash('sha256').update(device_id_buf).digest();
    const output = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      output[i] = data[i] ^ data[i+16];
    }
    return output.toString('hex');
  }
}

export class LocalSecurity {
  // private static readonly SIGN_KEY = Buffer.from('xhdiwjnchekd4d512chdjx5d8e4c394D2D7S', 'utf-8');
  // public static readonly ENC_KEY = createHash('md5').update(this.SIGN_KEY).digest();

  private readonly aes_key = Buffer.from('6a92ef406bad2f0359baad994171ea6d', 'hex');
  private readonly salt = Buffer.from('78686469776a6e6368656b6434643531326368646a783564386534633339344432443753', 'hex');
  private readonly iv = Buffer.alloc(16);

  private request_count = 0;
  private response_count = 0;

  private tcp_key?: Buffer;

  private aes_cbc_encrpyt(raw: Buffer, key: Buffer) {
    const cipher = createCipheriv('aes-256-cbc', key, this.iv);
    return Buffer.concat([cipher.update(raw), cipher.final()]);
  }

  private aes_cbc_decrypt(raw: Buffer, key: Buffer) {
    const decipher = createDecipheriv('aes-256-cbc', key, this.iv);
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(raw), decipher.final()]);
  }

  public aes_encrypt(data: Buffer) {
    const cipher = createCipheriv('aes-128-ecb', this.aes_key, null);
    return Buffer.concat([cipher.update(data), cipher.final()]);
  }

  public aes_decrypt(data: Buffer) {
    const decipher = createDecipheriv('aes-128-ecb', this.aes_key, null);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  public encode32_data(raw: Buffer) {
    return createHash('md5').update(Buffer.concat([raw, this.salt])).digest();
  }

  public tcp_key_from_resp(response: Buffer, key: Buffer) {
    if (response.toString() === 'ERROR') {
      throw Error('Authentication response is ERROR, cannot get TCP key.');
    }
    if (response.length !== 64) {
      throw Error('Authentication response has unexpected data length, cannot get TCP key..');
    }
    const payload = response.subarray(0, 32);
    const sign = response.subarray(32, response.length);
    const plain = this.aes_cbc_decrypt(payload, key);
    if (createHash('sha256').update(plain).digest().compare(sign) !== 0) {
      throw Error('Authentication sign does not match, cannot get TCP key.');
    }

    this.tcp_key = strxor(plain, key);
    this.request_count = 0;
    this.response_count = 0;

    return this.tcp_key;
  }

  public encode_8370(data: Buffer, message_type: TCPMessageType) {
    let header = Buffer.from([0x83, 0x70]);
    let size = data.length;
    let padding = 0;

    if (message_type === TCPMessageType.ENCRYPTED_REQUEST || message_type === TCPMessageType.ENCRYPTED_RESPONSE) {
      if ((size + 2) % 16 !== 0) {
        padding = 16 - (size + 2 & 0xf);
        size += padding + 32;
        data = Buffer.concat([data, randomBytes(padding)]);
      }
    }

    header = Buffer.concat([header, numberToUint8Array(size, 2, 'big')]);
    header = Buffer.concat([header, Buffer.from([0x20, padding << 4 | message_type])]);
    data = Buffer.concat([numberToUint8Array(this.request_count, 2, 'big'), data]);
    this.request_count += 1;
    if (this.request_count >= 0xFFFF) {
      this.request_count = 0;
    }
    if (message_type === TCPMessageType.ENCRYPTED_REQUEST || message_type === TCPMessageType.ENCRYPTED_RESPONSE) {
      const sign = createHash('sha256').update(Buffer.concat([header, data])).digest();
      data = Buffer.concat([this.aes_cbc_encrpyt(data, this.tcp_key!), sign]);
    }
    return Buffer.concat([header, data]);
  }

  public decode_8370(data: Buffer) {
    if (data.length < 6) {
      return [ [], data ];
    }
    const header = data.subarray(0, 6);
    if (header[0] !== 0x83 || header[1] !== 0x70) {
      throw new Error('Not an 8370 message.');
    }
    const size = header.subarray(2, 4).readUInt16BE() + 8;
    let leftover = Buffer.alloc(0);
    if (data.length < size) {
      return [ [], data ];
    } else if (data.length > size) {
      leftover = data.subarray(size, data.length);
      data = data.subarray(0, size);
    }
    if (header[4] !== 0x20) {
      throw new Error('Missing byte 4');
    }
    const padding = header[5] >> 4;
    const message_type_received = header[5] & 0xF;
    data = data.subarray(6, data.length);
    if ([TCPMessageType.ENCRYPTED_RESPONSE, TCPMessageType.ENCRYPTED_REQUEST].includes(message_type_received)) {
      const sign = data.subarray(data.length - 32, data.length);
      data = data.subarray(0, data.length - 32);
      data = this.aes_cbc_decrypt(data, this.tcp_key!);
      if (createHash('sha256').update(Buffer.concat([header, data])).digest() !== sign) {
        throw new Error('Sign does not match');
      }
      if (padding) {
        data = data.subarray(0, data.length - padding);
      }
    }
    this.response_count = data.subarray(0, 2).readUInt16BE();
    data = data.subarray(2, data.length);
    if (leftover.length > 0) {
      const [ packets, incomplete ] = this.decode_8370(leftover);
      return [ [ data, ...packets ], incomplete ];
    }
    return [ [ data ], leftover ];
  }
}