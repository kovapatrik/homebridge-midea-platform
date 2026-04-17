/***********************************************************************
 * Midea Heat Pump Water Heater Accessory class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type { CDAttributes } from '../devices/cd/MideaCDDevice.js';
import type MideaCDDevice from '../devices/cd/MideaCDDevice.js';
import { Mode } from '../devices/cd/MideaCDMessage.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class HeatPumpWaterHeaterAccessory extends BaseAccessory<MideaCDDevice> {
    protected readonly device: MideaCDDevice;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private energySaveModeService?;
    private standardModeService?;
    private eHeaterService?;
    private smartModeService?;
    private disinfectionService?;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaCDDevice, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<CDAttributes>): Promise<void>;
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getCurrentHeaterCoolerState(): CharacteristicValue;
    getTargetHeaterCoolerState(): CharacteristicValue;
    setTargetHeaterCoolerState(value: CharacteristicValue): Promise<void>;
    getCurrentTemperature(): CharacteristicValue;
    getTargetTemperature(): CharacteristicValue;
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
    getMode(mode: Mode): CharacteristicValue;
    setMode(value: CharacteristicValue, mode: Mode): Promise<void>;
    getDisinfection(): CharacteristicValue;
    setDisinfection(value: CharacteristicValue): Promise<void>;
}
