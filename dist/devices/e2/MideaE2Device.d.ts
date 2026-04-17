/***********************************************************************
 * Midea Electric Water Heater Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageQuery, MessageSet } from './MideaE2Message.js';
export interface E2Attributes extends DeviceAttributeBase {
    POWER: boolean;
    HEATING: boolean;
    KEEP_WARM: boolean;
    PROTECTION: boolean;
    CURRENT_TEMPERATURE?: number;
    TARGET_TEMPERATURE: number;
    WHOLE_TANK_HEATING: boolean;
    VARIABLE_HEATING: boolean;
    HEATING_TIME_REMAINING: number;
    WATER_CONSUMPTION?: number;
    HEATING_POWER?: number;
}
export default class MideaE2Device extends MideaDevice {
    attributes: E2Attributes;
    private _old_protocol;
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    get old_protocol(): boolean;
    build_query(): MessageQuery[];
    process_message(msg: Buffer): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<E2Attributes>): Promise<void>;
    protected set_subtype(): void;
}
