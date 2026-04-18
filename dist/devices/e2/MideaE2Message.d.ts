import { MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
declare abstract class MessageE2Base extends MessageRequest {
    constructor(device_protocol_version: number, message_type: MessageType, body_type: number);
}
export declare class MessageQuery extends MessageE2Base {
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessagePower extends MessageE2Base {
    power: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageNewProtocolSet extends MessageE2Base {
    [key: string]: any;
    target_temperature?: number;
    variable_heating?: boolean;
    whole_tank_heating?: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageSet extends MessageE2Base {
    [key: string]: any;
    target_temperature: number;
    variable_heating: boolean;
    whole_tank_heating: boolean;
    protection: boolean;
    constructor(device_protocol_version: number);
    get _body(): Buffer;
}
export declare class MessageE2Response extends MessageResponse {
    constructor(message: Buffer);
}
export {};
