import { BinaryLike, createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { TCPMessageType } from './MideaConstants';
import { concatUint8Arrays, numberToUint8Array, strxor } from './MideaUtils';

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
    const data = createHash('sha256').update(device_id_buf).digest().subarray(0, 16);
    const output = Buffer.alloc(16);
    for (let i = 0; i < 16; i++) {
      output[i] = data[i] ^ data[i+16];
    }
    return output.toString('hex');
  }
}

export class LocalSecurity {
  private static readonly SIGN_KEY = Buffer.from('xhdiwjnchekd4d512chdjx5d8e4c394D2D7S', 'utf-8');
  public static readonly ENC_KEY = createHash('md5').update(this.SIGN_KEY).digest();

  private readonly iv = new Uint8Array(Array(16).fill(0));

  private request_count = 0;
  private response_count = 0;

  private tcp_key?: Buffer;

  private aes_cbc_encrpyt(raw: BinaryLike, key: Buffer) {
    const cipher = createCipheriv('aes-128-cbc', key, this.iv);
    let encrypted = cipher.update(raw);
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    return encrypted;
  }

  private aes_cbc_decrypt(raw: Buffer, key: Buffer) {
    const decipher = createDecipheriv('aes-128-cbc', key, this.iv);
    let decrypted = decipher.update(raw);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted;
  }

  public sign(data: Buffer) {
    return createHash('md5').update(Buffer.concat([data, LocalSecurity.SIGN_KEY])).digest();
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

    if (createHash('sha256').update(plain).digest() !== sign) {
      throw Error('Authentication sign does not match, cannot get TCP key.');
    }

    this.tcp_key = strxor(plain, key);
    this.request_count = 0;
    this.response_count = 0;

    return this.tcp_key;
  }

  public encode_8370(data: Buffer, message_type: TCPMessageType) {
    let data_byte = new Uint8Array(data);
    let header = new Uint8Array([0x83, 0x70]);
    let size = data_byte.length;
    let padding = 0;

    if (message_type === TCPMessageType.ENCRYPTED_REQUEST || message_type === TCPMessageType.ENCRYPTED_RESPONSE) {
      if ((size + 2) % 16 !== 0) {
        padding = 16 - (size + 2 & 0xf);
        size += padding + 32;
        data_byte = concatUint8Arrays(data_byte, randomBytes(padding));
      }
    }

    header = concatUint8Arrays(header, numberToUint8Array(size, 2, 'big'));
    header = concatUint8Arrays(header, new Uint8Array([0x20, padding << 4 | message_type]));
    data_byte = concatUint8Arrays(numberToUint8Array(this.request_count, 2, 'big'), data_byte);
    this.request_count += 1;
    if (this.request_count >= 0xFFFF) {
      this.request_count = 0;
    }
    if (message_type === TCPMessageType.ENCRYPTED_REQUEST || message_type === TCPMessageType.ENCRYPTED_RESPONSE) {
      const sign = createHash('sha256').update(concatUint8Arrays(header, data)).digest();
      data_byte = Buffer.concat([this.aes_cbc_encrpyt(data_byte, this.tcp_key!), sign]);
    }
    return Buffer.concat([header, data_byte]);
  }
}