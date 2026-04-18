/***********************************************************************
 * Midea Electric Water Heater Device class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * With thanks to https://github.com/georgezhao2010/midea_ac_lan
 *
 */
import MideaDevice from '../../core/MideaDevice.js';
import { MessageE2Response, MessageNewProtocolSet, MessagePower, MessageQuery, MessageSet } from './MideaE2Message.js';
export default class MideaE2Device extends MideaDevice {
    attributes;
    _old_protocol;
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger, device_info, config, deviceConfig) {
        super(logger, device_info, config, deviceConfig);
        this.attributes = {
            POWER: false,
            HEATING: false,
            KEEP_WARM: false,
            PROTECTION: false,
            CURRENT_TEMPERATURE: undefined,
            TARGET_TEMPERATURE: 40,
            WHOLE_TANK_HEATING: false,
            VARIABLE_HEATING: false,
            HEATING_TIME_REMAINING: 0,
            WATER_CONSUMPTION: undefined,
            HEATING_POWER: undefined,
        };
        this._old_protocol = deviceConfig.E2_options.protocol;
    }
    get old_protocol() {
        return this.sub_type <= 82 || this.sub_type === 85 || this.sub_type === 36353;
    }
    build_query() {
        return [new MessageQuery(this.device_protocol_version)];
    }
    process_message(msg) {
        const message = new MessageE2Response(msg);
        if (this.verbose) {
            this.logger.debug(`[${this.name}] Body:\n${JSON.stringify(message.body)}`);
        }
        const changed = {};
        for (const status of Object.keys(this.attributes)) {
            const value = message.get_body_attribute(status.toLowerCase());
            if (value !== undefined) {
                if (this.attributes[status] !== value) {
                    // Track only those attributes that change value.  So when we send to the Homebridge /
                    // HomeKit accessory we only update values that change.  First time through this
                    // should be most/all attributes having initialized them to invalid values.
                    this.logger.debug(`[${this.name}] Value for ${status} changed from '${this.attributes[status]}' to '${value}'`);
                    changed[status] = value;
                }
                this.attributes[status] = value;
            }
        }
        // Now we update Homebridge / Homekit accessory
        if (Object.keys(changed).length > 0) {
            this.update(changed);
        }
        else {
            this.logger.debug(`[${this.name}] Status unchanged`);
        }
    }
    make_message_set() {
        const message = new MessageSet(this.device_protocol_version);
        message.protection = this.attributes.PROTECTION;
        message.whole_tank_heating = this.attributes.WHOLE_TANK_HEATING;
        message.target_temperature = this.attributes.TARGET_TEMPERATURE;
        message.variable_heating = this.attributes.VARIABLE_HEATING;
        return message;
    }
    async set_attribute(attributes) {
        const messageToSend = {
            POWER: undefined,
            SET: undefined,
            NEW_PROTOCOL_SET: undefined,
        };
        try {
            for (const [k, v] of Object.entries(attributes)) {
                if (v === this.attributes[k]) {
                    this.logger.info(`[${this.name}] Attribute ${k} already set to ${v}`);
                    continue;
                }
                this.logger.info(`[${this.name}] Set device attribute ${k} to: ${v}`);
                this.attributes[k] = v;
                // not sensor data
                if (!['HEATING', 'KEEP_WARM', 'CURRENT_TEMPERATURE'].includes(k)) {
                    const old_protocol = this._old_protocol !== 'auto' ? this._old_protocol === 'old' : this.old_protocol;
                    if (k === 'POWER') {
                        messageToSend.POWER ??= new MessagePower(this.device_protocol_version);
                        messageToSend.POWER.power = v;
                    }
                    else if (old_protocol) {
                        messageToSend.SET ??= this.make_message_set();
                        messageToSend.SET[k.toLowerCase()] = v;
                    }
                    else {
                        messageToSend.NEW_PROTOCOL_SET ??= new MessageNewProtocolSet(this.device_protocol_version);
                        messageToSend.NEW_PROTOCOL_SET[k.toLowerCase()] = v;
                    }
                }
            }
            for (const [k, v] of Object.entries(messageToSend)) {
                if (v !== undefined) {
                    this.logger.debug(`[${this.name}] Set message ${k}:\n${JSON.stringify(v)}`);
                    await this.build_send(v);
                }
            }
        }
        catch (err) {
            const msg = err instanceof Error ? err.stack : err;
            this.logger.debug(`[${this.name}] Error in set_attribute (${this.ip}:${this.port}):\n${msg}`);
        }
    }
    set_subtype() {
        this.logger.debug('No subtype for E2 device');
    }
}
//# sourceMappingURL=MideaE2Device.js.map