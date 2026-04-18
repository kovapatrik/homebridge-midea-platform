/***********************************************************************
 * Midea Gas Water Heater Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { MessageRequest } from '../../core/MideaMessage.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageSet } from './MideaE3Message.js';
export interface E3Attributes extends DeviceAttributeBase {
    POWER: boolean;
    BURNING_STATE: boolean;
    ZERO_COLD_WATER: boolean;
    PROTECTION: boolean;
    ZERO_COLD_PULSE: boolean;
    SMART_VOLUME: boolean;
    CURRENT_TEMPERATURE?: number;
    TARGET_TEMPERATURE: number;
}
export default class MideaE3Device extends MideaDevice {
    attributes: E3Attributes;
    private _old_subtypes;
    private _precision_halves;
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    get precision_halves(): boolean;
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<E3Attributes>): Promise<void>;
    protected set_subtype(): void;
}
