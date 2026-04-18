/***********************************************************************
 * Midea Platform Electric Water Heater Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaE2Device from '../devices/e2/MideaE2Device.js';
import type { E2Attributes } from '../devices/e2/MideaE2Device.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class ElectricWaterHeaterAccessory extends BaseAccessory<MideaE2Device> {
    protected readonly device: MideaE2Device;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private variableHeatingService?;
    private wholeTankHeatingService?;
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaE2Device, configDev: DeviceConfig);
    /*********************************************************************
     * Callback function called by MideaDevice whenever there is a change to
     * any attribute value.
     */
    protected updateCharacteristics(attributes: Partial<E2Attributes>): Promise<void>;
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
    getVariableHeating(): CharacteristicValue;
    setVariableHeating(value: CharacteristicValue): Promise<void>;
    getWholeTankHeating(): CharacteristicValue;
    setWholeTankHeating(value: CharacteristicValue): Promise<void>;
}
