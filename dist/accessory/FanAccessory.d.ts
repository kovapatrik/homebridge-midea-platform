/***********************************************************************
 * Midea Platform Fan Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaFADevice from '../devices/fa/MideaFADevice.js';
import type { FAAttributes } from '../devices/fa/MideaFADevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class FanAccessory extends BaseAccessory<MideaFADevice> {
    protected readonly device: MideaFADevice;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaFADevice, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<FAAttributes>): Promise<void>;
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getTargetFanState(): CharacteristicValue;
    setTargetFanState(_value: CharacteristicValue): Promise<void>;
    getCurrentFanState(): CharacteristicValue;
    getRotationSpeed(): CharacteristicValue;
    setRotationSpeed(value: CharacteristicValue): Promise<void>;
    getRotationDirection(): CharacteristicValue;
    setRotationDirection(_value: CharacteristicValue): Promise<void>;
    getSwingMode(): CharacteristicValue;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    getLockPhysicalControls(): CharacteristicValue;
    setLockPhysicalControls(value: CharacteristicValue): Promise<void>;
}
