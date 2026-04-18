import type { DeviceType } from './MideaConstants.js';
export declare enum MessageType {
    UNKNOWN = 0,
    SET = 2,
    QUERY = 3,
    NOTIFY1 = 4,
    NOTIFY2 = 5,
    EXCEPTION = 6,
    QUERY_SN = 7,
    EXCEPTION2 = 10,
    QUERY_SUBTYPE = 160
}
declare abstract class MessageBase {
    protected readonly HEADER_LENGTH = 10;
    protected abstract device_type: DeviceType;
    protected abstract message_type: MessageType;
    protected abstract body_type: number | null;
    protected abstract device_protocol_version: number;
    protected abstract body: Buffer;
    checksum(data: Buffer): number;
}
export declare abstract class MessageRequest extends MessageBase {
    device_type: DeviceType;
    message_type: MessageType;
    body_type: number | null;
    device_protocol_version: number;
    protected abstract _body: Buffer;
    constructor(device_type: DeviceType, message_type: MessageType, body_type: number | null, device_protocol_version: number);
    get body(): Buffer;
    get header(): Buffer;
    serialize(): Buffer;
}
export declare class MessageQuerySubtype extends MessageRequest {
    protected _body: Buffer;
    constructor(device_type: DeviceType);
}
export declare class MessageQuestCustom extends MessageRequest {
    protected _body: Buffer;
    protected cmd_body: Buffer;
    constructor(device_type: DeviceType, message_type: MessageType, cmd_body: Buffer);
    get body(): Buffer;
}
export declare class MessageBody {
    readonly data: Buffer;
    [k: string]: any;
    constructor(data: Buffer);
    get body_type(): number;
    static read_byte(data: Buffer, offset: number, default_value: number): number;
}
export declare class NewProtocolMessageBody extends MessageBody {
    protected packet_length: number;
    constructor(body: Buffer, body_type: number);
    static packet(param: number, value: Buffer, packet_length?: number): Buffer;
    parse(): {
        [key: string]: any;
    };
}
export declare class MessageResponse extends MessageBase {
    protected header: Buffer;
    protected device_type: DeviceType;
    protected message_type: MessageType;
    protected body_type: number;
    device_protocol_version: number;
    protected _body: MessageBody;
    constructor(message: Buffer | null | undefined);
    get body(): Buffer;
    set_body(body: MessageBody): void;
    get_body_type(): string;
    get_body_attribute(name: string): any;
}
export declare class MessageSubtypeResponse extends MessageResponse {
    sub_type: number;
    constructor(message: Buffer | null | undefined);
}
export {};
