/***********************************************************************
 * Midea Fan Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
class MessageFABase extends MessageRequest {
    constructor(device_protocol_version, message_type, body_type) {
        super(DeviceType.FAN, message_type, body_type, device_protocol_version);
    }
}
export class MessageQuery extends MessageFABase {
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.QUERY, null);
    }
    get _body() {
        return Buffer.from([]);
    }
    get body() {
        return Buffer.from([]);
    }
}
export class MessageSet extends MessageFABase {
    subtype;
    power;
    lock;
    mode;
    fan_speed;
    oscillate;
    oscillation_angle;
    oscillation_mode;
    tilting_angle;
    constructor(device_protocol_version, subtype) {
        super(device_protocol_version, MessageType.SET, 0x00);
        this.subtype = subtype;
    }
    get _body() {
        let body_return;
        if ((1 <= this.subtype && this.subtype <= 10) || this.subtype === 161) {
            // biome-ignore format: easier to read
            body_return = Buffer.from([
                0x00, 0x00, 0x00, 0x80,
                0x00, 0x00, 0x00, 0x80,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00
            ]);
            if (this.subtype !== 10) {
                body_return[13] = 0xff;
            }
        }
        else {
            // biome-ignore format: easier to read
            body_return = Buffer.from([
                0x00, 0x00, 0x00, 0x80,
                0x00, 0x00, 0x00, 0x80,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00
            ]);
        }
        if (this.power !== undefined) {
            body_return[3] = this.power ? 0x01 : 0x00;
        }
        if (this.lock !== undefined) {
            body_return[2] = this.lock ? 0x01 : 0x03;
        }
        if (this.mode !== undefined) {
            body_return[3] = 0x01 | (((this.mode + 1) << 1) & 0x1e);
        }
        if (this.fan_speed !== undefined && 1 <= this.fan_speed && this.fan_speed <= 26) {
            body_return[4] = this.fan_speed;
        }
        if (this.oscillate !== undefined) {
            body_return[7] = this.oscillate ? 0x01 : 0x00;
        }
        if (this.oscillation_angle !== undefined) {
            body_return[7] = 1 | body_return[7] | ((this.oscillation_angle << 4) & 0x70);
        }
        if (this.oscillation_mode !== undefined) {
            body_return[7] = 1 | body_return[7] | ((this.oscillation_mode << 1) & 0x0e);
        }
        if (this.tilting_angle !== undefined && body_return.length > 24) {
            body_return[24] = this.tilting_angle;
        }
        return body_return;
    }
}
export class FAGeneralMessageBody extends MessageBody {
    child_lock;
    power;
    mode;
    fan_speed;
    oscillate;
    oscillation_angle;
    oscillation_mode;
    tilting_angle;
    constructor(body) {
        super(body);
        const lock = body[3] & 0x03;
        this.child_lock = lock === 0x01;
        this.power = (body[4] & 0x01) > 0;
        const mode = (body[4] & 0x1e) >> 1;
        this.mode = mode > 0 ? mode - 1 : mode;
        const fan_speed = body[5];
        this.fan_speed = 1 <= fan_speed && fan_speed <= 26 ? fan_speed : 0;
        this.oscillate = (body[8] & 0x01) > 0;
        this.oscillation_angle = (body[8] & 0x70) >> 4;
        this.oscillation_mode = (body[8] & 0x0e) >> 1;
        this.tilting_angle = body.length > 25 ? body[25] : 0;
    }
}
export class MessageFAResponse extends MessageResponse {
    constructor(message) {
        super(message);
        if ([MessageType.QUERY, MessageType.SET, MessageType.NOTIFY1].includes(this.message_type)) {
            this.set_body(new FAGeneralMessageBody(this.body));
        }
    }
}
//# sourceMappingURL=MideaFAMessage.js.map