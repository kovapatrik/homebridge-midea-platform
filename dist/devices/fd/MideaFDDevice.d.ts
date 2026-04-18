/***********************************************************************
 * Midea Humidifier class
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
import { MessageSet } from './MideaFDMessage.js';
export interface FDAttributes extends DeviceAttributeBase {
    POWER: boolean;
    FAN_SPEED: number;
    PROMPT_TONE: boolean;
    TARGET_HUMIDITY: number;
    CURRENT_HUMIDITY: number;
    CURRENT_TEMPERATURE: number;
    TANK: number;
    MODE: number;
    SCREEN_DISPLAY: number;
    DISINFECT?: boolean;
}
export default class MideaFDDevice extends MideaDevice {
    attributes: FDAttributes;
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    set_subtype(): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<FDAttributes>): Promise<void>;
}
