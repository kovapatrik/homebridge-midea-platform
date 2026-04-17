import { TCPMessageType } from './MideaConstants.js';
export type KeyToken = Buffer | undefined;
export declare abstract class CloudSecurity {
    protected readonly LOGIN_KEY: string;
    abstract readonly IS_PROXIED: boolean;
    readonly IOT_KEY?: string;
    readonly HMAC_KEY?: string;
    constructor(login_key: string, iot_key?: bigint, hmac_key?: bigint);
    sign(data: string, random: string): string;
    encrpytPassword(loginId: string, password: string): string;
    static getUDPID(device_id_buf: Uint8Array): string;
}
export declare abstract class ProxiedSecurity extends CloudSecurity {
    abstract readonly APP_KEY: string;
    IS_PROXIED: boolean;
    abstract encrpytIAMPassword(loginId: string, password: string): string;
    getAppKeyAndIv(): {
        appKey: Buffer;
        iv: Buffer;
    };
    encryptAESAppKey(data: Buffer): Buffer;
    decryptAESAppKey(data: Buffer): Buffer;
}
export declare class MSmartHomeCloudSecurity extends ProxiedSecurity {
    static readonly _LOGIN_KEY = "ac21b9f9cbfe4ca5a88562ef25e2b768";
    readonly APP_KEY = "ac21b9f9cbfe4ca5a88562ef25e2b768";
    constructor();
    encrpytIAMPassword(loginId: string, password: string): string;
}
export declare class MeijuCloudSecurity extends ProxiedSecurity {
    static readonly _LOGIN_KEY = "ad0ee21d48a64bf49f4fb583ab76e799";
    readonly APP_KEY = "ac21b9f9cbfe4ca5a88562ef25e2b768";
    constructor();
    encrpytIAMPassword(_loginId: string, password: string): string;
}
export declare class SimpleSecurity extends CloudSecurity {
    IS_PROXIED: boolean;
    encrpytIAMPassword(): string;
    sign(url: string, query: string): string;
}
export declare class NetHomePlusSecurity extends SimpleSecurity {
    static readonly _LOGIN_KEY = "3742e9e5842d4ad59c2db887e12449f9";
    constructor();
}
export declare class ArtisonClimaSecurity extends SimpleSecurity {
    static readonly _LOGIN_KEY = "434a209a5ce141c3b726de067835d7f0";
    constructor();
}
export declare class LocalSecurity {
    private readonly aes_key;
    private readonly salt;
    private readonly iv;
    private request_count;
    private response_count;
    private tcp_key;
    private aes_cbc_encrpyt;
    private aes_cbc_decrypt;
    aes_encrypt(data: Buffer): Buffer;
    aes_decrypt(data: Buffer): Buffer;
    encode32_data(raw: Buffer): Buffer;
    tcp_key_from_resp(response: Buffer, key: Buffer): Buffer;
    encode_8370(dataToEncrypt: Buffer, message_type: TCPMessageType): Buffer;
    decode_8370(dataToDecrypt: Buffer): [Buffer[], Buffer];
}
