/***********************************************************************
 * Midea Heat Pump WiFi Controller Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan and
                  https://github.com/midea-lan/midea-local
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { MessageRequest } from '../../core/MideaMessage.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageSet } from './MideaC3Message.js';
export interface C3Attributes extends DeviceAttributeBase {
    ZONE1_POWER: boolean;
    ZONE2_POWER: boolean;
    DHW_POWER: boolean;
    ZONE1_CURVE: boolean;
    ZONE2_CURVE: boolean;
    FAST_DHW: boolean;
    ZONE_TEMPERATURE_TYPE: boolean[];
    ZONE1_ROOM_TEMPERATURE_MODE: boolean;
    ZONE2_ROOM_TEMPERATURE_MODE: boolean;
    ZONE1_WATER_TEMPERATURE_MODE: boolean;
    ZONE2_WATER_TEMPERATURE_MODE: boolean;
    MODE: number;
    MODE_AUTO: number;
    ZONE_TARGET_TEMPERATURE: number[];
    DHW_TARGET_TEMPERATURE: number;
    ROOM_TARGET_TEMPERATURE: number;
    ZONE_HEATING_TEMPERATURE_MAX: number[];
    ZONE_HEATING_TEMPERATURE_MIN: number[];
    ZONE_COOLING_TEMPERATURE_MAX: number[];
    ZONE_COOLING_TEMPERATURE_MIN: number[];
    TANK_ACTUAL_TEMPERATURE?: number;
    ROOM_TEMPERATURE_MAX: number;
    ROOM_TEMPERATURE_MIN: number;
    DHW_TEMPERATURE_MAX: number;
    DHW_TEMPERATURE_MIN: number;
    TARGET_TEMPERATURE: number[];
    TEMPERATURE_MAX: number[];
    TEMPERATURE_MIN: number[];
    STATUS_HEATING?: boolean;
    STATUS_DHW?: boolean;
    STATUS_TBH?: boolean;
    STATUS_IBH?: boolean;
    TOTAL_ENERGY_CONSUMPTION?: number;
    TOTAL_PRODUCED_ENERGY?: number;
    OUTDOOR_TEMPERATURE?: number;
    SILENT_MODE: boolean;
    ECO_MODE: boolean;
    TBH: boolean;
    ERROR_CODE: number;
    TEMP_TA?: number;
}
export default class MideaC3Device extends MideaDevice {
    attributes: C3Attributes;
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<C3Attributes>): Promise<void>;
    set_mode(zone: number, mode: number): Promise<void>;
    set_target_temperature(zone: number, target_temperature: number, mode?: number): Promise<void>;
    protected set_subtype(): void;
}
