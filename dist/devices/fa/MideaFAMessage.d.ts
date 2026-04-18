import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageFABase extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number | null);
}
export declare class MessageQuery extends MessageFABase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
    get body(): Buffer;
}
export declare class MessageSet extends MessageFABase {
    [key: string]: any;
    private subtype;
    power?: boolean;
    lock?: boolean;
    mode?: number;
    fan_speed?: number;
    oscillate?: boolean;
    oscillation_angle?: number;
    oscillation_mode?: number;
    tilting_angle?: number;
    constructor(device_protocol_version: number, subtype: number);
    get _body(): Buffer;
}
export declare class FAGeneralMessageBody extends MessageBody {
    child_lock: boolean;
    power: boolean;
    mode: number;
    fan_speed: number;
    oscillate: boolean;
    oscillation_angle: number;
    oscillation_mode: number;
    tilting_angle: number;
    constructor(body: Buffer);
}
export declare class MessageFAResponse extends MessageResponse {
    constructor(message: Buffer);
}
export {};
