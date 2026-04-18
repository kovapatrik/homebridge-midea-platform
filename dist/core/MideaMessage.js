export var MessageType;
(function (MessageType) {
    MessageType[MessageType["UNKNOWN"] = 0] = "UNKNOWN";
    MessageType[MessageType["SET"] = 2] = "SET";
    MessageType[MessageType["QUERY"] = 3] = "QUERY";
    MessageType[MessageType["NOTIFY1"] = 4] = "NOTIFY1";
    MessageType[MessageType["NOTIFY2"] = 5] = "NOTIFY2";
    MessageType[MessageType["EXCEPTION"] = 6] = "EXCEPTION";
    MessageType[MessageType["QUERY_SN"] = 7] = "QUERY_SN";
    MessageType[MessageType["EXCEPTION2"] = 10] = "EXCEPTION2";
    MessageType[MessageType["QUERY_SUBTYPE"] = 160] = "QUERY_SUBTYPE";
})(MessageType || (MessageType = {}));
class MessageBase {
    HEADER_LENGTH = 10;
    checksum(data) {
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            sum += data[i];
        }
        return (~sum + 1) & 0xff;
    }
}
export class MessageRequest extends MessageBase {
    device_type;
    message_type;
    body_type;
    device_protocol_version;
    constructor(device_type, message_type, body_type, device_protocol_version) {
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
    serialize() {
        let stream = Buffer.concat([this.header, this.body]);
        stream = Buffer.concat([stream, Buffer.from([this.checksum(stream.subarray(1, stream.length))])]);
        return stream;
    }
}
export class MessageQuerySubtype extends MessageRequest {
    _body = Buffer.alloc(18);
    constructor(device_type) {
        super(device_type, MessageType.QUERY_SUBTYPE, 0x00, 0);
    }
}
export class MessageQuestCustom extends MessageRequest {
    _body = Buffer.alloc(0);
    cmd_body;
    constructor(device_type, message_type, cmd_body) {
        super(device_type, message_type, 0x00, 0);
        this.cmd_body = cmd_body;
    }
    get body() {
        return this.cmd_body;
    }
}
export class MessageBody {
    data;
    constructor(data) {
        this.data = data;
    }
    get body_type() {
        return this.data[0];
    }
    static read_byte(data, offset, default_value) {
        return data.length > offset ? data[offset] : default_value;
    }
}
export class NewProtocolMessageBody extends MessageBody {
    packet_length;
    constructor(body, body_type) {
        super(body);
        if (body_type === 0xb5) {
            this.packet_length = 4;
        }
        else {
            this.packet_length = 5;
        }
    }
    static packet(param, value, packet_length = 4) {
        const length = value.length;
        if (packet_length === 4) {
            return Buffer.concat([Buffer.from([param & 0xff, param >> 8, length]), value]);
        }
        return Buffer.concat([Buffer.from([param & 0xff, param >> 8, 0x00, length]), value]);
    }
    parse() {
        // biome-ignore lint/suspicious/noExplicitAny: had to use any
        const result = {};
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
        }
        catch (e) {
            console.error(e);
        }
        return result;
    }
}
export class MessageResponse extends MessageBase {
    header;
    device_type;
    message_type;
    body_type;
    device_protocol_version;
    _body;
    constructor(message) {
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
    set_body(body) {
        this._body = body;
    }
    get_body_type() {
        return this._body.constructor.name;
    }
    get_body_attribute(name) {
        return this._body[name];
    }
}
export class MessageSubtypeResponse extends MessageResponse {
    sub_type;
    constructor(message) {
        super(message);
        if (this.message_type === MessageType.QUERY_SUBTYPE) {
            const body = message?.subarray(this.HEADER_LENGTH, -1);
            this.sub_type = body ? (body.length > 2 ? body[2] : 0) + (body.length > 3 ? body[3] << 8 : 0) : 0;
        }
        else {
            throw new Error('Invalid message type');
        }
    }
}
//# sourceMappingURL=MideaMessage.js.map