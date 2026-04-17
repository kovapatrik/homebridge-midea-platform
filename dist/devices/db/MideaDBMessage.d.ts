import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageDBBase extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessageQuery extends MessageDBBase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessagePower extends MessageDBBase {
    power: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageStart extends MessageDBBase {
    start: boolean;
    washing_data: Buffer;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class DBGeneralMessageBody extends MessageBody {
    power: boolean;
    start: boolean;
    washing_data: Buffer;
    progress: number;
    time_remaining?: number;
    constructor(body: Buffer);
}
export declare class MessageDBResponse extends MessageResponse {
    constructor(message: Buffer);
}
export {};
