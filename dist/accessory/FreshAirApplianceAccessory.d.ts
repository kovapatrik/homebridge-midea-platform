/***********************************************************************
 * Midea Platform Fresh Air Appliance Accessory class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaCEDevice from '../devices/ce/MideaCEDevice.js';
import type { CEAttributes } from '../devices/ce/MideaCEDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class FreshAirApplianceAccessory extends BaseAccessory<MideaCEDevice> {
    protected readonly device: MideaCEDevice;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private silentModeService?;
    private autoSetModeService?;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaCEDevice, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<CEAttributes>): Promise<void>;
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getCurrentHeaterCoolerState(): CharacteristicValue;
    getTargetHeaterCoolerState(): CharacteristicValue;
    setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void>;
    getCurrentTemperature(): CharacteristicValue;
    getTargetTemperature(): CharacteristicValue;
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
}
