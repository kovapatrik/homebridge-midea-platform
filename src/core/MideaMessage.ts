import type { DeviceType } from './MideaConstants.js';

export enum MessageType {
  UNKNOWN = 0x00,
  SET = 0x02,
  QUERY = 0x03,
  NOTIFY1 = 0x04,
  NOTIFY2 = 0x05,
  EXCEPTION = 0x06,
  QUERY_SN = 0x07,
  EXCEPTION2 = 0x0a,
  QUERY_SUBTYPE = 0xa0,
}

abstract class MessageBase {
  protected readonly HEADER_LENGTH = 10;

  protected abstract device_type: DeviceType;
  protected abstract message_type: MessageType;
  protected abstract body_type: number | null;
  protected abstract device_protocol_version: number;

  protected abstract body: Buffer;

  public checksum(data: Buffer) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return (~sum + 1) & 0xff;
  }
}

export abstract class MessageRequest extends MessageBase {
  device_type: DeviceType;
  message_type: MessageType;
  body_type: number | null;
  device_protocol_version: number;

  protected abstract _body: Buffer;

  constructor(device_type: DeviceType, message_type: MessageType, body_type: number | null, device_protocol_version: number) {
    super();
    this.device_type = device_type;
    this.message_type = message_type;
    this.body_type = body_type;
    this.device_protocol_version = device_protocol_version;
  }

  get body() {
    return Buffer.from(this.body_type && this._body ? [this.body_type, ...this._body] : this.body_type ? [this.body_type] : this._body ? this._body : []);
  }

  get header() {
    const length = this.HEADER_LENGTH + this.body.length;
    return Buffer.from([
      // flag
      0xaa,
      // length
      length,
      // device type
      this.device_type,
      // frame checksum
      0x00, // this.device_type ^ length,
      // unused
      0x00,
      0x00,
      // frame ID
      0x00,
      // frame protocol version
      0x00,
      // device protocol version
      this.device_protocol_version,
      // frame type
      this.message_type,
    ]);
  }

  public serialize() {
    let stream = Buffer.concat([this.header, this.body]);
    stream = Buffer.concat([stream, Buffer.from([this.checksum(stream.subarray(1, stream.length))])]);
    return stream;
  }
}

export class MessageQuerySubtype extends MessageRequest {
  protected _body = Buffer.alloc(18);

  constructor(device_type: DeviceType) {
    super(device_type, MessageType.QUERY_SUBTYPE, 0x00, 0);
  }
}

export class MessageQuestCustom extends MessageRequest {
  protected _body = Buffer.alloc(0);
  protected cmd_body: Buffer;
  constructor(device_type: DeviceType, message_type: MessageType, cmd_body: Buffer) {
    super(device_type, message_type, 0x00, 0);
    this.cmd_body = cmd_body;
  }

  get body() {
    return this.cmd_body;
  }
}

export class MessageBody {
  // biome-ignore lint/suspicious/noExplicitAny: had to use any
  [k: string]: any;
  constructor(public readonly data: Buffer) {}

  get body_type() {
    return this.data[0];
  }

  static read_byte(data: Buffer, offset: number, default_value: number) {
    return data.length > offset ? data[offset] : default_value;
  }
}

export class NewProtocolMessageBody extends MessageBody {
  protected packet_length: number;

  constructor(body: Buffer, body_type: number) {
    super(body);

    if (body_type === 0xb5) {
      this.packet_length = 4;
    } else {
      this.packet_length = 5;
    }
  }

  static packet(param: number, value: Buffer, packet_length = 4) {
    const length = value.length;
    if (packet_length === 4) {
      return Buffer.concat([Buffer.from([param & 0xff, param >> 8, length]), value]);
    } else {
      return Buffer.concat([Buffer.from([param & 0xff, param >> 8, 0x00, length]), value]);
    }
  }

  public parse() {
    // biome-ignore lint/suspicious/noExplicitAny: had to use any
    const result: { [key: string]: any } = {};
    let offset = 2;
    try {
      while (offset < this.data.length) {
        const param = this.data[offset] + (this.data[offset + 1] << 8);
        if (this.packet_length === 5) {
          offset++;
        }
        const length = this.data[offset + 2];
        if (length > 0) {
          const value = this.data.subarray(offset + 3, offset + 3 + length);
          result[param] = value;
        }
        offset += 3 + length;
      }
    } catch (e) {
      console.error(e);
    }
    return result;
  }
}

export class MessageResponse extends MessageBase {
  protected header: Buffer;
  protected device_type: DeviceType;
  protected message_type: MessageType;
  protected body_type: number;
  public device_protocol_version: number;

  protected _body: MessageBody;

  constructor(message: Buffer | null | undefined) {
    super();
    if (message === null || message === undefined || message.length < this.HEADER_LENGTH + 1) {
      throw new Error('Invalid message length');
    }
    this.header = message.subarray(0, this.HEADER_LENGTH);
    this.device_protocol_version = this.header[8];
    this.message_type = this.header[this.header.length - 1];
    this.device_type = this.header[2];

    this._body = new MessageBody(message.subarray(this.HEADER_LENGTH, -1));
    this.body_type = this._body.body_type;
  }

  get body() {
    return this._body.data;
  }

  set_body(body: MessageBody) {
    this._body = body;
  }

  get_body_type() {
    return this._body.constructor.name;
  }

  get_body_attribute(name: string) {
    return this._body[name];
  }
}

export class MessageSubtypeResponse extends MessageResponse {
  public sub_type: number;

  constructor(message: Buffer | null | undefined) {
    super(message);
    if (this.message_type === MessageType.QUERY_SUBTYPE) {
      const body = message!.subarray(this.HEADER_LENGTH, -1);
      this.sub_type = (body.length > 2 ? body[2] : 0) + (body.length > 3 ? body[3] << 8 : 0);
    } else {
      throw new Error('Invalid message type');
    }
  }
}
