/***********************************************************************
 * Midea Fresh Air Appliance Device message handler class
 *
 * Copyright (c) 2025 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import { DeviceType } from '../../core/MideaConstants.js';
import { MessageBody, MessageRequest, MessageResponse, MessageType } from '../../core/MideaMessage.js';
class MessageCEBase extends MessageRequest {
    constructor(device_protocol_version, message_type, body_type) {
        super(DeviceType.FRESH_AIR_APPLIANCE, message_type, body_type, device_protocol_version);
    }
}
export class MessageQuery extends MessageCEBase {
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.QUERY, 0x01);
    }
    get _body() {
        return Buffer.alloc(0);
    }
}
export class MessageSet extends MessageCEBase {
    power;
    mode;
    auto_set_mode;
    silent_mode;
    silent_mode_level;
    target_temperature;
    constructor(device_protocol_version) {
        super(device_protocol_version, MessageType.SET, 0x01);
        this.power = false;
        this.mode = 4; // auto
        this.auto_set_mode = false;
        this.silent_mode = false;
        this.silent_mode_level = 0;
        this.target_temperature = 25;
    }
    get _body() {
        const power = this.power ? 0x01 : 0x00;
        const auto_set_mode = this.auto_set_mode ? 0x02 : 0x00;
        const silent_mode = this.silent_mode ? 0x04 : 0x00;
        // biome-ignore format: easier to read
        return Buffer.from([
            power | auto_set_mode | silent_mode,
            this.mode,
            this.silent_mode_level,
            this.target_temperature
        ]);
    }
}
export class CEGeneralMessageBody extends MessageBody {
    power;
    auto_set_mode;
    silent_mode;
    mode;
    silent_mode_level;
    target_temperature;
    current_temperature;
    error_code;
    run_mode_under_auto_control;
    constructor(body) {
        super(body);
        this.power = (body[1] & 0x01) > 0;
        this.auto_set_mode = (body[1] & 0x02) > 0;
        this.silent_mode = (body[1] & 0x04) > 0;
        this.mode = body[2];
        this.silent_mode_level = body[3];
        this.target_temperature = body[4];
        this.current_temperature = body[5] >= 128 ? 256 - body[5] : body[5];
        this.error_code = body[6];
        this.run_mode_under_auto_control = body[7];
    }
}
export class MessageCEResponse extends MessageResponse {
    constructor(message) {
        super(message);
        if (([MessageType.QUERY, MessageType.SET].includes(this.message_type) && this.body_type === 0x01) || this.message_type === MessageType.NOTIFY1) {
            this.set_body(new CEGeneralMessageBody(this.body));
        }
    }
}
//# sourceMappingURL=MideaCEMessage.js.map