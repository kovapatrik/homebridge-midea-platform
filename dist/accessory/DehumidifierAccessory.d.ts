/***********************************************************************
 * Midea Platform Dehumidifier Accessory class
 *
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 * With thanks to https://github.com/kovapatrik/homebridge-midea-platform
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { Service } from 'homebridge';
import type MideaA1Device from '../devices/a1/MideaA1Device.js';
import type { A1Attributes } from '../devices/a1/MideaA1Device.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import { type DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class DehumidifierAccessory extends BaseAccessory<MideaA1Device> {
    protected readonly device: MideaA1Device;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private temperatureService?;
    private fanService?;
    private humiditySensorService?;
    private pumpService?;
    private waterTankService?;
    private serviceVersion;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaA1Device, configDev: DeviceConfig);
    /*********************************************************************
     * Callback function called by MideaDevice whenever there is a change to
     * any attribute value.
     */
    protected updateCharacteristics(attributes: Partial<A1Attributes>): Promise<void>;
    /*********************************************************************
     * Callback functions for each Homebridge/HomeKit service
     *
     */
    private getActive;
    private setActive;
    private getCurrentHumidifierDehumidifierState;
    private currentHumidifierDehumidifierState;
    private getTargetHumidifierDehumidifierState;
    private setTargetHumidifierDehumidifierState;
    private getCurrentRelativeHumidity;
    private getRelativeHumidityDehumidifierThreshold;
    private setRelativeHumidityDehumidifierThreshold;
    private getRotationSpeed;
    private setRotationSpeed;
    private getWaterLevel;
    private getTemperature;
    private getPump;
    private setPump;
    private getWaterTankFull;
}
