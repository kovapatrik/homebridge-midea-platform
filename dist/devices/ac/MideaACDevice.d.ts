/***********************************************************************
 * Midea Air Conditioner Device class
 *
 * Copyright (c) 2023 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import type { Logger } from 'homebridge';
import type { DeviceInfo } from '../../core/MideaConstants.js';
import MideaDevice, { type DeviceAttributeBase } from '../../core/MideaDevice.js';
import { type Config, type DeviceConfig, SwingAngle } from '../../platformUtils.js';
import { MessageGeneralSet, MessageNewProtocolQuery, MessagePowerQuery, MessageQuery, MessageSubProtocolSet } from './MideaACMessage.js';
export interface ACAttributes extends DeviceAttributeBase {
    PROMPT_TONE: boolean;
    POWER: boolean | undefined;
    MODE: number;
    TARGET_TEMPERATURE: number;
    FAN_SPEED: number;
    FAN_AUTO: boolean;
    SWING_VERTICAL: boolean | undefined;
    WIND_SWING_UD_ANGLE: number;
    SWING_HORIZONTAL: boolean | undefined;
    WIND_SWING_LR_ANGLE: number;
    SMART_EYE: boolean;
    DRY: boolean;
    AUX_HEATING: boolean;
    BOOST_MODE: boolean;
    SLEEP_MODE: boolean;
    FROST_PROTECT: boolean;
    COMFORT_MODE: boolean;
    ECO_MODE: boolean;
    NATURAL_WIND: boolean;
    TEMP_FAHRENHEIT: boolean;
    SCREEN_DISPLAY: boolean | undefined;
    SCREEN_DISPLAY_NEW: boolean;
    FULL_DUST: boolean;
    INDOOR_TEMPERATURE?: number;
    OUTDOOR_TEMPERATURE?: number;
    INDIRECT_WIND: boolean;
    INDOOR_HUMIDITY: number | undefined;
    BREEZELESS: boolean;
    TOTAL_ENERGY_CONSUMPTION?: number;
    CURRENT_ENERGY_CONSUMPTION?: number;
    REALTIME_POWER: number;
    FRESH_AIR_POWER: boolean;
    FRESH_AIR_FAN_SPEED: number;
    FRESH_AIR_MODE?: string;
    FRESH_AIR_1: boolean;
    FRESH_AIR_2: boolean;
    RATE_SELECT?: number;
    SELF_CLEAN?: boolean;
    ION?: boolean;
}
export default class MideaACDevice extends MideaDevice {
    readonly FRESH_AIR_FAN_SPEEDS: {
        0: string;
        20: string;
        40: string;
        60: string;
        80: string;
        100: string;
    };
    readonly FRESH_AIR_FAN_SPEEDS_REVERSE: {
        100: string;
        80: string;
        60: string;
        40: string;
        20: string;
        0: string;
    };
    attributes: ACAttributes;
    private fresh_air_version?;
    private used_subprotocol;
    private bb_sn8_flag;
    private bb_timer;
    private readonly DEFAULT_POWER_ANALYSIS_METHOD;
    private power_analysis_method?;
    private alternate_switch_display;
    private last_fan_speed;
    private defaultFahrenheit;
    private defaultScreenOff;
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger: Logger, device_info: DeviceInfo, config: Config, deviceConfig: DeviceConfig);
    build_query(): (MessageQuery | MessagePowerQuery | MessageNewProtocolQuery)[];
    process_message(msg: Buffer): void;
    make_message_set(): MessageGeneralSet;
    make_subprotocol_message_set(): MessageSubProtocolSet;
    make_message_unique_set(): MessageGeneralSet | MessageSubProtocolSet;
    set_attribute(attributes: Partial<ACAttributes>): Promise<void>;
    set_alternate_switch_display(value: boolean): void;
    set_target_temperature(target_temperature: number, mode?: number): Promise<void>;
    set_swing(swing_horizontal: boolean, swing_vertical: boolean): Promise<void>;
    set_fan_auto(fan_auto: boolean): Promise<void>;
    set_swing_angle(swing_direction: SwingAngle, swing_angle: number): Promise<void>;
    set_self_clean(self_clean: boolean): Promise<void>;
    set_ion(ion: boolean): Promise<void>;
    set_rate_select(rate_select: number): Promise<void>;
    protected set_subtype(): void;
}
