/***********************************************************************
 * Midea Heat Pump Water Heater Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
export declare enum Mode {
    EnergySave = 1,
    Standard = 2,
    Compatibilizing = 3,// e-heater
    Smart = 4,
    Vacation = 5
}
declare abstract class MessageCDBase extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessageQuery extends MessageCDBase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSet extends MessageCDBase {
    [key: string]: any;
    power: boolean;
    target_temperature: number;
    mode: Mode;
    tr_temperature: number;
    open_ptc: boolean;
    ptc_temperature: number;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSetSterilize extends MessageCDBase {
    [key: string]: any;
    sterilize: boolean;
    auto_sterilize_week: number;
    auto_sterilize_hour: number;
    auto_sterilize_minute: number;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class CDGeneralMessageBody extends MessageBody {
    power: boolean;
    mode: Mode;
    heat: number;
    eco: number;
    target_temperature: number;
    current_temperature: number;
    top_temperature: number;
    bottom_temperature: number;
    condenser_temperature: number;
    outdoor_temperature: number;
    compressor_temperature: number;
    max_temperature: number;
    min_temperature: number;
    error_code: number;
    bottom_elec_heat: boolean;
    top_elec_heat: boolean;
    water_pump: boolean;
    compressor_status: boolean;
    wind?: string;
    four_way: boolean;
    elec_heat: boolean;
    back_water: boolean;
    sterilize: boolean;
    typeinfo: number;
    water_level?: number;
    smart_grid?: boolean;
    multi_terminal?: boolean;
    fahrenheit?: boolean;
    mute_effect?: boolean;
    mute_status?: boolean;
    auto_sterilize_week?: number;
    auto_sterilize_hour?: number;
    auto_sterilize_minute?: number;
    constructor(body: Buffer);
}
export declare class CD01MessageBody extends MessageBody {
    power: boolean;
    mode: number;
    target_temperature: number;
    tr_temperature: number;
    open_ptc: boolean;
    ptc_temperature: number;
    byte8: number;
    constructor(body: Buffer);
}
export declare class CD06MessageBody extends MessageBody {
    sterilize: boolean;
    auto_sterilize_week: number;
    auto_sterilize_hour: number;
    auto_sterilize_minute: number;
    constructor(body: Buffer);
}
export declare class MessageCDResponse extends MessageResponse {
    constructor(message: Buffer);
}
export {};
