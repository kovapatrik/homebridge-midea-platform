/***********************************************************************
 * Midea Fan class
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
import { MessageSet } from './MideaFAMessage.js';
export interface FAAttributes extends DeviceAttributeBase {
    POWER: boolean;
    CHILD_LOCK: boolean;
    MODE: number;
    FAN_SPEED: number;
    OSCILLATE: boolean;
    OSCILLATION_ANGLE: number;
    OSCILLATION_MODE: number;
    TILTING_ANGLE: number;
}
export default class MideaFADevice extends MideaDevice {
    attributes: FAAttributes;
    private default_speed_count;
    private speed_count;
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    set_subtype(): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<FAAttributes>): Promise<void>;
}
