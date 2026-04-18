/***********************************************************************
 * Midea Platform Air Conditioner Accessory class
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaACDevice from '../devices/ac/MideaACDevice.js';
import type { ACAttributes } from '../devices/ac/MideaACDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import { type DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';
export default class AirConditionerAccessory extends BaseAccessory<MideaACDevice> {
    protected readonly device: MideaACDevice;
    protected readonly configDev: DeviceConfig;
    protected service: Service;
    private outDoorTemperatureService?;
    private displayService?;
    private fanOnlyService?;
    private fanService?;
    private ecoModeService?;
    private breezeAwayService?;
    private dryModeService?;
    private boostModeService?;
    private auxService?;
    private auxHeatingService?;
    private selfCleanService?;
    private ionService?;
    private rateSelectService?;
    private sleepModeService?;
    private swingAngleService?;
    private comfortModeService?;
    private temperatureSensorService?;
    private swingAngleMainControl;
    private heatingThresholdTemperature;
    private coolingThresholdTemperature;
    private readonly useThermostat;
    /*********************************************************************
     * Constructor registers all the service types with Homebridge, registers
     * a callback function with the MideaDevice class, and requests device status.
     */
    constructor(platform: MideaPlatform, accessory: MideaAccessory, device: MideaACDevice, configDev: DeviceConfig);
    private withoutPromptTone;
    /*********************************************************************
     * Callback function called by MideaDevice whenever there is a change to
     * any attribute value.
     */
    protected updateCharacteristics(attributes: Partial<ACAttributes>): Promise<void>;
    /*********************************************************************
     * Unified state handlers — branch internally based on service type
     */
    getCurrentState(): CharacteristicValue;
    getTargetState(): CharacteristicValue;
    setTargetState(value: CharacteristicValue): Promise<void>;
    /*********************************************************************
     * Callback functions for each Homebridge/HomeKit service
     */
    getActive(): CharacteristicValue;
    setActive(value: CharacteristicValue): Promise<void>;
    getTemperatureDisplayUnits(): CharacteristicValue;
    setTemperatureDisplayUnits(value: CharacteristicValue): Promise<void>;
    getCurrentTemperature(): CharacteristicValue;
    getTargetTemperature(): CharacteristicValue;
    setTargetTemperature(value: CharacteristicValue): Promise<void>;
    setTargetTemperatureWithinThresholds(): Promise<void>;
    getCoolingThresholdTemperature(): CharacteristicValue;
    getHeatingThresholdTemperature(): CharacteristicValue;
    getFanOnlyMode(): CharacteristicValue;
    setFanOnlyMode(value: CharacteristicValue): Promise<void>;
    getFanState(): CharacteristicValue;
    setFanState(value: CharacteristicValue): Promise<void>;
    setHeatingCoolingTemperatureThresholds(thresholds: {
        heating?: number;
        cooling?: number;
    }): void;
    setCoolingThresholdTemperature(value: CharacteristicValue): Promise<void>;
    setHeatingThresholdTemperature(value: CharacteristicValue): Promise<void>;
    getSwingMode(): CharacteristicValue;
    setSwingMode(value: CharacteristicValue): Promise<void>;
    getRotationSpeed(): CharacteristicValue;
    setRotationSpeed(value: CharacteristicValue): Promise<void>;
    getOutdoorTemperature(): CharacteristicValue;
    getDisplayActive(): CharacteristicValue;
    setDisplayActive(value: CharacteristicValue): Promise<void>;
    getEcoMode(): CharacteristicValue;
    setEcoMode(value: CharacteristicValue): Promise<void>;
    getBreezeAway(): CharacteristicValue;
    setBreezeAway(value: CharacteristicValue): Promise<void>;
    getDryMode(): CharacteristicValue;
    setDryMode(value: CharacteristicValue): Promise<void>;
    getBoostMode(): CharacteristicValue;
    setBoostMode(value: CharacteristicValue): Promise<void>;
    getAux(): CharacteristicValue;
    setAux(value: CharacteristicValue): Promise<void>;
    getAuxHeating(): CharacteristicValue;
    setAuxHeating(value: CharacteristicValue): Promise<void>;
    getSelfCleanState(): CharacteristicValue;
    setSelfCleanState(value: CharacteristicValue): Promise<void>;
    getIonState(): CharacteristicValue;
    setIonState(value: CharacteristicValue): Promise<void>;
    getRateSelect(): CharacteristicValue;
    setRateSelect(value: CharacteristicValue): Promise<void>;
    getSwingAngleCurrentPosition(): CharacteristicValue;
    getSwingAngleTargetPosition(): CharacteristicValue;
    setSwingAngleTargetPosition(value: CharacteristicValue): Promise<void>;
    getSwingAnglePositionState(): CharacteristicValue;
    getSwingAngleCurrentHorizontalTiltAngle(): CharacteristicValue;
    getSwingAngleTargetHorizontalTiltAngle(): CharacteristicValue;
    setSwingAngleTargetHorizontalTiltAngle(value: CharacteristicValue): Promise<void>;
    getSwingAngleCurrentVerticalTiltAngle(): CharacteristicValue;
    getSwingAngleTargetVerticalTiltAngle(): CharacteristicValue;
    setSwingAngleTargetVerticalTiltAngle(value: CharacteristicValue): Promise<void>;
    getSleepMode(): CharacteristicValue;
    setSleepMode(value: CharacteristicValue): Promise<void>;
    getComfortMode(): CharacteristicValue;
    setComfortMode(value: CharacteristicValue): Promise<void>;
}
