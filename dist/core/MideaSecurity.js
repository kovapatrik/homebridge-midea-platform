import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import { unescape as nodeUnescape } from 'node:querystring';
import { Endianness, TCPMessageType } from './MideaConstants.js';
import { numberToUint8Array, strxor } from './MideaUtils.js';
function unescape_plus(str) {
    return nodeUnescape(str.replace(/\+/g, ' '));
}
export class CloudSecurity {
    LOGIN_KEY;
    IOT_KEY;
    HMAC_KEY;
    constructor(login_key, iot_key, hmac_key) {
        this.LOGIN_KEY = login_key;
        if (hmac_key) {
            this.HMAC_KEY = Buffer.from(hmac_key.toString(16), 'hex').toString();
        }
        if (iot_key) {
            this.IOT_KEY = Buffer.from(iot_key.toString(16), 'hex').toString();
        }
    }
    // Generate a HMAC signature for the provided data and random data.
    sign(data, random) {
        const message = `${this.IOT_KEY}${data}${random}`;
        // biome-ignore lint/style/noNonNullAssertion: HMAC_KEY is defined in the constructor
        return createHmac('sha256', this.HMAC_KEY).update(message).digest('hex');
    }
    // Encrypt the password for cloud API password.
    encrpytPassword(loginId, password) {
        const m1 = createHash('sha256').update(password);
        const login_hash = `${loginId}${m1.digest('hex')}${this.LOGIN_KEY}`;
        const m2 = createHash('sha256').update(login_hash);
        return m2.digest('hex');
    }
    static getUDPID(device_id_buf) {
        const data = createHash('sha256').update(device_id_buf).digest();
        const output = Buffer.alloc(16);
        for (let i = 0; i < 16; i++) {
            output[i] = data[i] ^ data[i + 16];
        }
        return output.toString('hex');
    }
}
export class ProxiedSecurity extends CloudSecurity {
    IS_PROXIED = true;
    getAppKeyAndIv() {
        const hash = createHash('sha256').update(Buffer.from(this.APP_KEY, 'utf8')).digest('hex');
        return {
            appKey: Buffer.from(hash.substring(0, 16)),
            iv: Buffer.from(hash.substring(16, 32)),
        };
    }
    encryptAESAppKey(data) {
        const { appKey, iv } = this.getAppKeyAndIv();
        const cipher = createCipheriv('aes-128-cbc', appKey, iv);
        return Buffer.concat([cipher.update(data), cipher.final()]);
    }
    decryptAESAppKey(data) {
        const { appKey, iv } = this.getAppKeyAndIv();
        const decipher = createDecipheriv('aes-128-cbc', appKey, iv);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }
}
export class MSmartHomeCloudSecurity extends ProxiedSecurity {
    static _LOGIN_KEY = 'ac21b9f9cbfe4ca5a88562ef25e2b768';
    APP_KEY = 'ac21b9f9cbfe4ca5a88562ef25e2b768';
    constructor() {
        super(MSmartHomeCloudSecurity._LOGIN_KEY, BigInt('7882822598523843940'), BigInt('117390035944627627450677220413733956185864939010425'));
    }
    encrpytIAMPassword(loginId, password) {
        const m1 = createHash('md5').update(password);
        const m2 = createHash('md5').update(m1.digest('hex'));
        const login_hash = `${loginId}${m2.digest('hex')}${this.LOGIN_KEY}`;
        const sha = createHash('sha256').update(login_hash);
        return sha.digest('hex');
    }
}
export class MeijuCloudSecurity extends ProxiedSecurity {
    static _LOGIN_KEY = 'ad0ee21d48a64bf49f4fb583ab76e799';
    APP_KEY = 'ac21b9f9cbfe4ca5a88562ef25e2b768';
    constructor() {
        super(MeijuCloudSecurity._LOGIN_KEY, BigInt('9795516279659324117647275084689641883661667'), BigInt('117390035944627627450677220413733956185864939010425'));
    }
    encrpytIAMPassword(_loginId, password) {
        const m1 = createHash('md5').update(password);
        const m2 = createHash('md5').update(m1.digest('hex'));
        return m2.digest('hex');
    }
}
export class SimpleSecurity extends CloudSecurity {
    IS_PROXIED = false;
    encrpytIAMPassword() {
        return '';
    }
    sign(url, query) {
        const parsedUrl = new URL(url);
        const path = parsedUrl.pathname;
        return createHash('sha256')
            .update(Buffer.from(`${path}${unescape_plus(query)}${this.LOGIN_KEY}`, 'ascii'))
            .digest('hex');
    }
}
export class NetHomePlusSecurity extends SimpleSecurity {
    static _LOGIN_KEY = '3742e9e5842d4ad59c2db887e12449f9';
    constructor() {
        super(NetHomePlusSecurity._LOGIN_KEY);
    }
}
export class ArtisonClimaSecurity extends SimpleSecurity {
    static _LOGIN_KEY = '434a209a5ce141c3b726de067835d7f0';
    constructor() {
        super(ArtisonClimaSecurity._LOGIN_KEY);
    }
}
export class LocalSecurity {
    aes_key = Buffer.from(BigInt('141661095494369103254425781617665632877').toString(16), 'hex');
    salt = Buffer.from(BigInt('233912452794221312800602098970898185176935770387238278451789080441632479840061417076563').toString(16), 'hex');
    iv = Buffer.alloc(16);
    request_count = 0;
    response_count = 0;
    tcp_key = Buffer.alloc(0);
    aes_cbc_encrpyt(raw, key) {
        const cipher = createCipheriv('aes-256-cbc', key, this.iv);
        cipher.setAutoPadding(false);
        return Buffer.concat([cipher.update(raw), cipher.final()]);
    }
    aes_cbc_decrypt(raw, key) {
        const decipher = createDecipheriv('aes-256-cbc', key, this.iv);
        decipher.setAutoPadding(false);
        return Buffer.concat([decipher.update(raw), decipher.final()]);
    }
    aes_encrypt(data) {
        const cipher = createCipheriv('aes-128-ecb', this.aes_key, null);
        return Buffer.concat([cipher.update(data), cipher.final()]);
    }
    aes_decrypt(data) {
        const decipher = createDecipheriv('aes-128-ecb', this.aes_key, null);
        return Buffer.concat([decipher.update(data), decipher.final()]);
    }
    encode32_data(raw) {
        return createHash('md5')
            .update(Buffer.concat([raw, this.salt]))
            .digest();
    }
    tcp_key_from_resp(response, key) {
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
    encode_8370(dataToEncrypt, message_type) {
        if (message_type !== TCPMessageType.HANDSHAKE_REQUEST && message_type !== TCPMessageType.HANDSHAKE_RESPONSE && this.tcp_key.length === 0) {
            throw new Error('TCP key is not set.');
        }
        let data = dataToEncrypt;
        let header = Buffer.from([0x83, 0x70]);
        let size = data.length;
        let padding = 0;
        if (message_type === TCPMessageType.ENCRYPTED_REQUEST || message_type === TCPMessageType.ENCRYPTED_RESPONSE) {
            if ((size + 2) % 16 !== 0) {
                padding = 16 - ((size + 2) & 0xf);
                size += padding + 32;
                data = Buffer.concat([data, randomBytes(padding)]);
            }
        }
        header = Buffer.concat([header, numberToUint8Array(size, 2, Endianness.Big)]);
        header = Buffer.concat([header, Buffer.from([0x20, (padding << 4) | message_type])]);
        data = Buffer.concat([numberToUint8Array(this.request_count, 2, Endianness.Big), data]);
        this.request_count += 1;
        if (this.request_count >= 0xffff) {
            this.request_count = 0;
        }
        if (message_type === TCPMessageType.ENCRYPTED_REQUEST || message_type === TCPMessageType.ENCRYPTED_RESPONSE) {
            const sign = createHash('sha256')
                .update(Buffer.concat([header, data]))
                .digest();
            data = Buffer.concat([this.aes_cbc_encrpyt(data, this.tcp_key), sign]);
        }
        return Buffer.concat([header, data]);
    }
    decode_8370(dataToDecrypt) {
        let data = dataToDecrypt;
        if (data.length < 6) {
            return [[], data];
        }
        if (this.tcp_key.length === 0) {
            throw new Error('TCP key is not set.');
        }
        const header = data.subarray(0, 6);
        if (header[0] !== 0x83 || header[1] !== 0x70) {
            throw new Error('Not an 8370 message.');
        }
        const size = header.subarray(2, 4).readUInt16BE() + 8;
        let leftover = Buffer.alloc(0);
        if (data.length < size) {
            return [[], data];
        }
        if (data.length > size) {
            leftover = data.subarray(size, data.length);
            data = data.subarray(0, size);
        }
        if (header[4] !== 0x20) {
            throw new Error('Missing byte 4');
        }
        const padding = header[5] >> 4;
        const message_type_received = header[5] & 0xf;
        data = data.subarray(6, data.length);
        if ([TCPMessageType.ENCRYPTED_RESPONSE, TCPMessageType.ENCRYPTED_REQUEST].includes(message_type_received)) {
            const sign = data.subarray(data.length - 32, data.length);
            data = data.subarray(0, data.length - 32);
            data = this.aes_cbc_decrypt(data, this.tcp_key);
            if (createHash('sha256')
                .update(Buffer.concat([header, data]))
                .digest()
                .compare(sign) !== 0) {
                throw new Error('Sign does not match');
            }
            if (padding) {
                data = data.subarray(0, data.length - padding);
            }
        }
        this.response_count = data.subarray(0, 2).readUInt16BE();
        data = data.subarray(2, data.length);
        if (leftover.length > 0) {
            const [packets, incomplete] = this.decode_8370(leftover);
            return [[data, ...packets], incomplete];
        }
        return [[data], leftover];
    }
}
//# sourceMappingURL=MideaSecurity.js.map