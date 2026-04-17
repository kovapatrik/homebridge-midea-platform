/***********************************************************************
 * Midea Dishwasher Device class
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
import { MessageQuery } from './MideaE1Message.js';
export interface E1Attributes extends DeviceAttributeBase {
    POWER: boolean;
    STATUS?: number;
    MODE: number;
    ADDITIONAL: number;
    DOOR: boolean;
    RINSE_AID: boolean;
    SALT: boolean;
    START_PAUSE: boolean;
    START: boolean;
    CHILD_LOCK: boolean;
    UV: boolean;
    DRY: boolean;
    DRY_STATUS: boolean;
    STORAGE: boolean;
    STORAGE_STATUS: boolean;
    TIME_REMAINING?: number;
    PROGRESS?: number;
    STORAGE_REMAINING?: number;
    TEMPERATURE?: number;
    HUMIDITY?: number;
    WATERSWITCH: boolean;
    WATER_LACK: boolean;
    ERROR_CODE?: number;
    SOFTWATER: number;
    WRONG_OPERATION?: number;
    BRIGHT?: number;
}
export default class MideaE1Device extends MideaDevice {
    attributes: E1Attributes;
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageQuery[];
    process_message(msg: Buffer): void;
    set_attribute(attributes: Partial<E1Attributes>): Promise<void>;
    protected set_subtype(): void;
}
