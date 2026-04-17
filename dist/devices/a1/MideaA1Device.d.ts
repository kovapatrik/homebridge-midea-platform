/***********************************************************************
 * Midea Dehumidifier Device class
 *
 * Copyright (c) 2023 David Kerr, https://github.com/dkerr64
 *
 * With thanks to https://github.com/kovapatrik/homebridge-midea-platform
 * And https://github.com/georgezhao2010/midea_ac_lan
 *
 * An instance of this class is created for each device the platform registers.
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageQuery, MessageSet } from './MideaA1Message.js';
export interface A1Attributes extends DeviceAttributeBase {
    POWER: boolean | undefined;
    PROMPT_TONE: boolean;
    CHILD_LOCK: boolean | undefined;
    MODE: number;
    FAN_SPEED: number;
    SWING: boolean | undefined;
    TARGET_HUMIDITY: number;
    ANION: boolean;
    TANK_LEVEL: number;
    WATER_LEVEL_SET: number;
    TANK_FULL: boolean;
    CURRENT_HUMIDITY: number;
    CURRENT_TEMPERATURE: number;
    DEFROSTING: boolean;
    FILTER_INDICATOR: boolean;
    PUMP: boolean;
    PUMP_SWITCH_FLAG: boolean;
    SLEEP_MODE: boolean;
}
export default class MideaA1Device extends MideaDevice {
    readonly MIN_HUMIDITY: number;
    readonly MAX_HUMIDITY: number;
    readonly HUMIDITY_STEP: number;
    attributes: A1Attributes;
    readonly MODES: {
        0: string;
        1: string;
        2: string;
        3: string;
        4: string;
    };
    readonly SPEEDS: {
        1: string;
        40: string;
        60: string;
        80: string;
        102: string;
        127: string;
    };
    readonly WATER_LEVEL_SETS: {
        25: string;
        50: string;
        75: string;
        100: string;
    };
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageQuery[];
    process_message(msg: Buffer): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<A1Attributes>): Promise<void>;
    protected set_subtype(): void;
}
