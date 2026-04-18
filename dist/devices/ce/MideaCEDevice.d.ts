/***********************************************************************
 * Midea Fresh Air Appliance Device class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import type { MessageRequest } from '../../core/MideaMessage.js';
import type { Config, DeviceConfig } from '../../platformUtils.js';
import { MessageSet } from './MideaCEMessage.js';
export interface CEAttributes extends DeviceAttributeBase {
    POWER: boolean;
    AUTO_SET_MODE: boolean;
    SILENT_MODE: boolean;
    MODE: number;
    SILENT_MODE_LEVEL: number;
    TARGET_TEMPERATURE: number;
    CURRENT_TEMPERATURE: number;
    ERROR_CODE: number;
    RUN_MODE_UNDER_AUTO_CONTROL: number;
}
export default class MideaCEDevice extends MideaDevice {
    attributes: CEAttributes;
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    set_subtype(): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<CEAttributes>): Promise<void>;
}
