import { MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageA1Base extends MessageRequest {
    private static message_serial;
    private message_id;
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
    get body(): Buffer;
}
export declare class MessageQuery extends MessageA1Base {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageNewProtocolQuery extends MessageA1Base {
    private readonly alternate_display;
    constructor(device_protocol_version: number, alternate_display?: boolean);
    get _body(): Buffer;
}
export declare class MessageSet extends MessageA1Base {
    power: boolean;
    prompt_tone: boolean;
    mode: number;
    fan_speed: number;
    child_lock: boolean;
    target_humidity: number;
    swing: boolean;
    anion: boolean;
    water_level_set: number;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageNewProtocolSet extends MessageA1Base {
    light: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageA1Response extends MessageResponse {
    private readonly message;
    constructor(message: Buffer);
}
export {};
