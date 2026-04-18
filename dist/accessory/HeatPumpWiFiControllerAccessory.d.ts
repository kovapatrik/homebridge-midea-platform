/***********************************************************************
 * Midea Heat Pump WiFi Controller Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { Service } from 'homebridge';
import type MideaC3Device from '../devices/c3/MideaC3Device.js';
import type { C3Attributes } from '../devices/c3/MideaC3Device.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class HeatPumpWiFiControllerAccessory extends BaseAccessory<MideaC3Device> {
    protected readonly device: MideaC3Device;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private zone1Service?;
    private zone1CurveSwitchService?;
    private zone1PowerSwitchService?;
    private zone1WaterTemperatureModeSensorService?;
    private zone1RoomTemperatureModeService?;
    private zone2Service?;
    private zone2CurveSwitchService?;
    private zone2PowerSwitchService?;
    private zone2WaterTemperatureModeSensorService?;
    private zone2RoomTemperatureModeService?;
    private waterHeaterService?;
    private dhwPowerSwitchService?;
    private tbhPowerSwitchService?;
    private dhwSensorService?;
    private tbhSensorService?;
    private ibhSensorService?;
    private heatingSensorService?;
    private disinfectSwitchService?;
    private ecoSwitchService?;
    private silentModeSwitchService?;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaC3Device, configDev: DeviceConfig);
    updateCharacteristics(attributes: Partial<C3Attributes>): Promise<void>;
}
