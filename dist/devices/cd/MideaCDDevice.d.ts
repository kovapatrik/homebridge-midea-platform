/***********************************************************************
 * Midea Heat Pump Water Heater Device class
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
import { MessageSet, Mode } from './MideaCDMessage.js';
export interface CDAttributes extends DeviceAttributeBase {
    POWER: boolean;
    MODE: Mode;
    MAX_TEMPERATURE: number;
    MIN_TEMPERATURE: number;
    TARGET_TEMPERATURE: number;
    CURRENT_TEMPERATURE?: number;
    OUTDOOR_TEMPERATURE?: number;
    CONDENSER_TEMPERATURE?: number;
    COMPRESSOR_TEMPERATURE?: number;
    COMPRESSOR_STATUS?: number;
    TR_TEMPERATURE?: number;
    OPEN_PTC?: boolean;
    PTC_TEMPERATURE?: number;
    STERILIZE: boolean;
    AUTO_STERILIZE_WEEK: number;
    AUTO_STERILIZE_HOUR: number;
    AUTO_STERILIZE_MINUTE: number;
}
export default class MideaCDDevice extends MideaDevice {
    attributes: CDAttributes;
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    set_subtype(): void;
    make_message_set(): MessageSet;
    set_attribute(attributes: Partial<CDAttributes>): Promise<void>;
    set_sterilize(sterilize: boolean): Promise<void>;
}
