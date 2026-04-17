import MideaDevice from '../../core/MideaDevice.js';
import { MessageA1Response, MessageQuery, MessageSet } from './MideaA1Message.js';
export default class MideaA1Device extends MideaDevice {
    MIN_HUMIDITY;
    MAX_HUMIDITY;
    HUMIDITY_STEP;
    attributes;
    MODES = {
        0: 'Off',
        1: 'Auto',
        2: 'Continuous',
        3: 'Clothes-Dry',
        4: 'Shoes-Dry',
    };
    SPEEDS = {
        1: 'Lowest',
        40: 'Low',
        60: 'Medium',
        80: 'High',
        102: 'Auto',
        127: 'Off',
    };
    WATER_LEVEL_SETS = {
        25: 'Low',
        50: 'Medium',
        75: 'High',
        100: 'Full',
    };
    /*********************************************************************
     * Constructor initializes all the attributes.  We set some to invalid
     * values so that they are detected as "changed" on the first status
     * refresh... and passed back to the Homebridge/HomeKit accessory callback
     * function to set their initial values.
     */
    constructor(logger, device_info, config, deviceConfig) {
        super(logger, device_info, config, deviceConfig);
        this.attributes = {
            POWER: undefined, // invalid
            PROMPT_TONE: false,
            CHILD_LOCK: undefined,
            MODE: 0,
            FAN_SPEED: 0,
            SWING: undefined, // invalid
            TARGET_HUMIDITY: 0,
            ANION: false,
            TANK_LEVEL: 0,
            WATER_LEVEL_SET: 50,
            TANK_FULL: false,
            CURRENT_HUMIDITY: 0,
            CURRENT_TEMPERATURE: 0,
            DEFROSTING: false,
            FILTER_INDICATOR: false,
            PUMP: false,
            PUMP_SWITCH_FLAG: false,
            SLEEP_MODE: false,
        };
        this.MIN_HUMIDITY = deviceConfig.A1_options.minHumidity;
        this.MAX_HUMIDITY = deviceConfig.A1_options.maxHumidity;
        this.HUMIDITY_STEP = deviceConfig.A1_options.humidityStep;
    }
    build_query() {
        return [new MessageQuery(this.device_protocol_version)];
    }
    process_message(msg) {
        const message = new MessageA1Response(msg);
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
        message.power = !!this.attributes.POWER; // force to boolean
        message.prompt_tone = this.attributes.PROMPT_TONE;
        message.mode = this.attributes.MODE;
        message.child_lock = !!this.attributes.CHILD_LOCK; // force to boolean
        message.fan_speed = this.attributes.FAN_SPEED;
        message.target_humidity = this.attributes.TARGET_HUMIDITY;
        message.swing = !!this.attributes.SWING;
        message.anion = this.attributes.ANION;
        message.water_level_set = this.attributes.WATER_LEVEL_SET;
        return message;
    }
    async set_attribute(attributes) {
        const messageToSend = {
            SET: undefined,
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
                if (!['CURRENT_TEMPERATURE', 'CURRENT_HUMIDITY', 'TANK_FULL', 'DEFROSTING', 'FILTER_INDICATOR', 'PUMP'].includes(k)) {
                    if (k === 'PROMPT_TONE') {
                        this.attributes.PROMPT_TONE = !!v;
                    }
                    else {
                        messageToSend.SET ??= this.make_message_set();
                        // TODO handle MODE, FAN_SPEED and WATER_LEVEL_SET to ensure valid value.
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
        this.logger.debug('No subtype for A1 (dehumidifier) device');
    }
}
//# sourceMappingURL=MideaA1Device.js.map