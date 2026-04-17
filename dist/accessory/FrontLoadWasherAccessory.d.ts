/***********************************************************************
 * Midea Platform Front Load Washer Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaDBDevice from '../devices/db/MideaDBDevice.js';
import type { DBAttributes } from '../devices/db/MideaDBDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class FanAccessory extends BaseAccessory<MideaDBDevice> {
    protected readonly device: MideaDBDevice;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaDBDevice, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<DBAttributes>): Promise<void>;
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getInUse(): CharacteristicValue;
    getRemainingDuration(): CharacteristicValue;
}
