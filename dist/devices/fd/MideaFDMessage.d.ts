import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageFDBase extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number | null);
}
export declare class MessageQuery extends MessageFDBase {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSet extends MessageFDBase {
    [key: string]: any;
    power: boolean;
    fan_speed: number;
    target_humidity: number;
    prompt_tone: boolean;
    screen_display: number;
    mode: number;
    disinfect?: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class FDC8MessageBody extends MessageBody {
    power: boolean;
    fan_speed: number;
    target_humidity: number;
    current_humidity: number;
    current_temperature: number;
    tank: number;
    mode: number;
    screen_display: number;
    disinfect?: boolean;
    constructor(body: Buffer);
}
export declare class FDA0MessageBody extends MessageBody {
    power: boolean;
    fan_speed: number;
    target_humidity: number;
    current_humidity: number;
    current_temperature: number;
    tank: number;
    mode: number;
    screen_display: number;
    disinfect?: boolean;
    constructor(body: Buffer);
}
export declare class MessageFDResponse extends MessageResponse {
    constructor(message: Buffer);
}
export {};
