import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
export declare enum NewProtocolTags {
    ZERO_COLD_WATER = 3,
    ZERO_COLD_PULSE = 4,
    SMART_VOLUME = 7,
    TARGET_TEMPERATURE = 8
}
declare abstract class MessageE3Base extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessageQuery extends MessageE3Base {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessagePower extends MessageE3Base {
    power: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSet extends MessageE3Base {
    [key: string]: any;
    target_temperature: number;
    zero_cold_water: boolean;
    bathtub_volume: number;
    protection: boolean;
    zero_cold_pulse: boolean;
    smart_volume: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageNewProtocolSet extends MessageE3Base {
    key?: keyof typeof NewProtocolTags;
    value?: number | boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class E3GeneralMessageBody extends MessageBody {
    power: boolean;
    burning_state: boolean;
    zero_cold_water: boolean;
    current_temperature: number;
    target_temperature: number;
    protection: boolean;
    zero_cold_pulse: boolean;
    smart_volume: boolean;
    constructor(body: Buffer);
}
export declare class MessageE3Response extends MessageResponse {
    constructor(message: Buffer);
}
export {};
