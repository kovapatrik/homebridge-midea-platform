import type { Service } from 'homebridge';
import type MideaDevice from '../core/MideaDevice.js';
import type { DeviceAttributeBase } from '../core/MideaDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
export default abstract class BaseAccessory<T extends MideaDevice> {
    protected readonly platform: MideaPlatform;
    protected readonly accessory: MideaAccessory;
    protected readonly device: T;
    protected readonly configDev: DeviceConfig;
    protected abstract service: Service;
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: T, configDev: DeviceConfig);
    handleConfiguredName(service: Service, subtype: string, fallbackName: string): void;
    protected abstract updateCharacteristics(attributes: DeviceAttributeBase): Promise<void>;
}
export declare function limitValue(value: number, min: number, max: number): number;
