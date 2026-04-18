/***********************************************************************
 * Midea Fresh Air Appliance Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageCEBase extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessageQuery extends MessageCEBase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSet extends MessageCEBase {
    [key: string]: any;
    power: boolean;
    mode: number;
    auto_set_mode: boolean;
    silent_mode: boolean;
    silent_mode_level: number;
    target_temperature: number;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class CEGeneralMessageBody extends MessageBody {
    power: boolean;
    auto_set_mode: boolean;
    silent_mode: boolean;
    mode: number;
    silent_mode_level: number;
    target_temperature: number;
    current_temperature: number;
    error_code: number;
    run_mode_under_auto_control: number;
    constructor(body: Buffer);
}
export declare class MessageCEResponse extends MessageResponse {
    constructor(message: Buffer);
}
export {};
