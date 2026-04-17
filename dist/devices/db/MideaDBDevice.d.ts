/***********************************************************************
 * Midea Front Load Washer class
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
export interface DBAttributes extends DeviceAttributeBase {
    POWER: boolean;
    START: boolean;
    WASHING_DATA: Buffer;
    PROGRESS: number;
    TIME_REMAINING: number;
}
export default class MideaDBDevice extends MideaDevice {
    attributes: DBAttributes;
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): MessageRequest[];
    process_message(msg: Buffer): void;
    set_subtype(): void;
    set_attribute(attributes: Partial<DBAttributes>): Promise<void>;
}
