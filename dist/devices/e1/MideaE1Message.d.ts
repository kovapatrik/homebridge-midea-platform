import { MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageE1Base extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessagePower extends MessageE1Base {
    power: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageLock extends MessageE1Base {
    lock: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageStorage extends MessageE1Base {
    storage: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageQuery extends MessageE1Base {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageE1Response extends MessageResponse {
    constructor(message: Buffer);
}
export {};
