/***********************************************************************
 * Midea Gas Water Heater Device message handler class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
export var NewProtocolTags;
(function (NewProtocolTags) {
    NewProtocolTags[NewProtocolTags["ZERO_COLD_WATER"] = 3] = "ZERO_COLD_WATER";
    NewProtocolTags[NewProtocolTags["ZERO_COLD_PULSE"] = 4] = "ZERO_COLD_PULSE";
    NewProtocolTags[NewProtocolTags["SMART_VOLUME"] = 7] = "SMART_VOLUME";
    NewProtocolTags[NewProtocolTags["TARGET_TEMPERATURE"] = 8] = "TARGET_TEMPERATURE";
})(NewProtocolTags || (NewProtocolTags = {}));
class MessageE3Base extends MessageRequest {
    constructor(device_protocol_version, message_type, body_type) {
        super(DeviceType.GAS_WATER_HEATER, message_type, body_type, device_protocol_version);
    }
}
export class MessageQuery extends MessageE3Base {
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.QUERY, 0x01);
    }
    get _body() {
        return Buffer.from([0x01]);
    }
}
export class MessagePower extends MessageE3Base {
    power;
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.SET, 0x02);
        this.power = false;
    }
    get _body() {
        if (this.power) {
            this.body_type = 0x01;
        }
        else {
            this.body_type = 0x02;
        }
        return Buffer.from([0x01]);
    }
}
export class MessageSet extends MessageE3Base {
    target_temperature;
    zero_cold_water;
    bathtub_volume;
    protection;
    zero_cold_pulse;
    smart_volume;
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.SET, 0x04);
        this.target_temperature = 0;
        this.zero_cold_water = false;
        this.bathtub_volume = 0;
        this.protection = false;
        this.zero_cold_pulse = false;
        this.smart_volume = false;
    }
    get _body() {
        // Byte 2 zero_cold_water mode
        const zero_cold_water = this.zero_cold_water ? 0x01 : 0x00;
        // Byte 3
        const protection = this.protection ? 0x08 : 0x00;
        const zero_cold_pulse = this.zero_cold_pulse ? 0x10 : 0x00;
        const smart_volume = this.smart_volume ? 0x20 : 0x00;
        // Byte 5
        const target_temperature = this.target_temperature & 0xff;
        // biome-ignore format: easier to read
        return Buffer.from([
            0x01,
            zero_cold_water | 0x02,
            protection | zero_cold_pulse | smart_volume,
            0x00,
            target_temperature,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00,
        ]);
    }
}
export class MessageNewProtocolSet extends MessageE3Base {
    key;
    value;
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.SET, 0x14);
    }
    get _body() {
        if (this.key === undefined || this.value === undefined) {
            throw new Error('key and value must be set');
        }
        const key = NewProtocolTags[this.key];
        if (key === undefined) {
            throw new Error('Invalid key');
        }
        let value;
        if (this.key === 'TARGET_TEMPERATURE') {
            value = this.value;
        }
        else {
            value = this.value ? 0x01 : 0x00;
        }
        // biome-ignore format: easier to read
        return Buffer.from([
            key, value,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x00
        ]);
    }
}
export class E3GeneralMessageBody extends MessageBody {
    power;
    burning_state;
    zero_cold_water;
    current_temperature;
    target_temperature;
    protection;
    zero_cold_pulse;
    smart_volume;
    constructor(body) {
        super(body);
        this.power = (body[2] & 0x01) > 0;
        this.burning_state = (body[2] & 0x02) > 0;
        this.zero_cold_water = (body[2] & 0x04) > 0;
        this.current_temperature = body[5];
        this.target_temperature = body[6];
        this.protection = (body[8] & 0x08) > 0;
        this.zero_cold_pulse = body.length > 20 ? (body[20] & 0x01) > 0 : false;
        this.smart_volume = body.length > 20 ? (body[20] & 0x02) > 0 : false;
    }
}
export class MessageE3Response extends MessageResponse {
    constructor(message) {
        super(message);
        if ((this.message_type === MessageType.QUERY && this.body_type === 0x01) ||
            (this.message_type === MessageType.SET && [0x01, 0x02, 0x04, 0x14].includes(this.body_type)) ||
            (this.message_type === MessageType.NOTIFY1 && [0x00, 0x01].includes(this.body_type))) {
            this.set_body(new E3GeneralMessageBody(this.body));
        }
    }
}
//# sourceMappingURL=MideaE3Message.js.map