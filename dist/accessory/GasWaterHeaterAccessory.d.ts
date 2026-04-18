/***********************************************************************
 * Midea Platform Gas Water Heater Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaE3Device from '../devices/e3/MideaE3Device.js';
import type { E3Attributes } from '../devices/e3/MideaE3Device.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class GasWaterHeaterAccessory extends BaseAccessory<MideaE3Device> {
    protected readonly device: MideaE3Device;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private burningStateService?;
    private protectionService?;
    private zeroColdWaterService?;
    private zeroColdPulseService?;
    private smartVolumeService?;
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaE3Device, configDev: DeviceConfig);
    /*********************************************************************
     * Callback function called by MideaDevice whenever there is a change to
     * any attribute value.
     */
    protected updateCharacteristics(attributes: Partial<E3Attributes>): Promise<void>;
    /*********************************************************************
     * Callback functions for each Homebridge/HomeKit service
     *
     */
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getCurrentHeaterCoolerState(): CharacteristicValue;
    getTargetHeaterCoolerState(): CharacteristicValue;
    setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void>;
    getCurrentTemperature(): CharacteristicValue;
    getTargetTemperature(): CharacteristicValue;
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
    getBurningState(): CharacteristicValue;
    getProtection(): CharacteristicValue;
    getZeroColdWater(): CharacteristicValue;
    setZeroColdWater(value: CharacteristicValue): Promise<void>;
    getZeroColdPulse(): CharacteristicValue;
    setZeroColdPulse(value: CharacteristicValue): Promise<void>;
    getSmartVolume(): CharacteristicValue;
    setSmartVolume(value: CharacteristicValue): Promise<void>;
}
