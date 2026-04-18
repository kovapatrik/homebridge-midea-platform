import { Semaphore } from 'semaphore-promise';
import type { Endianness } from './MideaConstants.js';
import { CloudSecurity } from './MideaSecurity.js';
declare abstract class CloudBase<S extends CloudSecurity> {
    protected readonly account: string;
    protected readonly password: string;
    protected readonly security: S;
    protected readonly CLIENT_TYPE = 1;
    protected readonly FORMAT = 2;
    protected readonly LANGUAGE = "en_US";
    protected abstract readonly APP_ID: string;
    protected abstract readonly API_URL: string;
    protected readonly DEVICE_ID: string;
    protected access_token?: string;
    protected uid?: string;
    protected key?: string;
    protected semaphore: Semaphore;
    loggedIn: boolean;
    constructor(account: string, password: string, security: S);
    protected timestamp(): string;
    abstract buildRequestData(): {
        [key: string]: string | number;
    };
    abstract apiRequest(endpoint: string, data: {
        [key: string]: any;
    }): Promise<any>;
    isProxied(): boolean;
    getLoginId(): Promise<any>;
    abstract login(): Promise<void>;
    getTokenKey(device_id: number, endianess: Endianness): Promise<[Buffer, Buffer]>;
}
export default class CloudFactory {
    static createCloud(account: string, password: string, cloud: string): CloudBase<CloudSecurity>;
}
export {};
