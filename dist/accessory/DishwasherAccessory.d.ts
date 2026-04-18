/***********************************************************************
 * Midea Platform Dishwasher Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaE1Device from '../devices/e1/MideaE1Device.js';
import type { E1Attributes } from '../devices/e1/MideaE1Device.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class DishwasherAccessory extends BaseAccessory<MideaE1Device> {
    protected readonly device: MideaE1Device;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaE1Device, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<E1Attributes>): Promise<void>;
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getInUse(): CharacteristicValue;
    getRemainingDuration(): CharacteristicValue;
}
