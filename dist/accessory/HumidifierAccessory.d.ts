/***********************************************************************
 * Midea Platform Humidifier Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaFDDevice from '../devices/fd/MideaFDDevice.js';
import type { FDAttributes } from '../devices/fd/MideaFDDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class FanAccessory extends BaseAccessory<MideaFDDevice> {
    protected readonly device: MideaFDDevice;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaFDDevice, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<FDAttributes>): Promise<void>;
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
}
