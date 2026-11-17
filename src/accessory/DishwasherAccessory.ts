/***********************************************************************
 * Midea Platform Dishwasher Accessory class
 *
 * Copyright (c) 2024 Kovalovszky Patrik, https://github.com/kovapatrik
 *
 * Based on https://github.com/homebridge/homebridge-plugin-template
 *
 * An instance of this class is created for each accessory the platform registers.
 *
 */
import type { CharacteristicValue, Service } from 'homebridge';
import type MideaE1Device from '../devices/e1/MideaE1Device.js';
import { E1Modes, E1Status, type E1Attributes } from '../devices/e1/MideaE1Device.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import BaseAccessory from './BaseAccessory.js';

const programSubtypePrefix = 'program_';
const saltSensorSubtype = 'saltSensor';
const rinseAidSensorSubtype = 'rinseAidSensor';

// A follow-up command (start a program after power on or after a cancel,
// power off after a cancel) is sent once the dishwasher reports the state it
// needs. While waiting, the status is queried every POLL_INTERVAL_MS. Right
// after power on the dishwasher reports idle before it accepts a start (it only
// selects the program), so the command is repeated, at most once per
// POLL_INTERVAL_MS, until the dishwasher reports the expected result. It is
// dropped after READY_TIMEOUT_MS.
const POLL_INTERVAL_MS = 2000;
const READY_TIMEOUT_MS = 30000;

type PendingCommand = {
  name: string;
  // The command can be sent.
  ready: () => boolean;
  // The command took effect.
  done: () => boolean;
  run: () => Promise<void>;
  deadline: number;
  poll: NodeJS.Timeout;
  lastRun?: number;
};

type ProgramSwitch = {
  mode: number;
  service: Service;
};

export default class DishwasherAccessory extends BaseAccessory<MideaE1Device> {
  protected service: Service;

  private programSwitches: ProgramSwitch[] = [];
  private saltSensorService?: Service;
  private rinseAidSensorService?: Service;
  // Remaining time at the start of the current run, used as SetDuration so
  // that the Home app can show the countdown.
  private runDuration = 0;
  // Follow-up command waiting for the dishwasher to reach the right state.
  private pendingCommand?: PendingCommand;

  /*********************************************************************
   * Constructor registers all the service types with Homebridge, registers
   * a callback function with the MideaDevice class, and requests device status.
   */
  constructor(
    platform: MideaPlatform,
    accessory: MideaAccessory,
    protected readonly device: MideaE1Device,
    protected readonly configDev: DeviceConfig,
  ) {
    super(platform, accessory, device, configDev);

    this.service = this.accessory.getService(this.platform.Service.Valve) || this.accessory.addService(this.platform.Service.Valve);

    this.service.getCharacteristic(this.platform.Characteristic.Active).onGet(this.getActive.bind(this)).onSet(this.setActive.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.InUse).onGet(this.getInUse.bind(this));
    this.service.getCharacteristic(this.platform.Characteristic.ValveType).onGet(() => this.platform.Characteristic.ValveType.GENERIC_VALVE);
    this.service
      .getCharacteristic(this.platform.Characteristic.RemainingDuration)
      .setProps({ minValue: 0, maxValue: 60 * 60 * 8, minStep: 1 })
      .onGet(this.getRemainingDuration.bind(this));
    this.service
      .getCharacteristic(this.platform.Characteristic.SetDuration)
      .setProps({ minValue: 0, maxValue: 60 * 60 * 8, minStep: 1 })
      .onGet(this.getSetDuration.bind(this))
      .onSet(() => {
        // The program decides the duration; restore the actual value.
        setTimeout(() => this.service.updateCharacteristic(this.platform.Characteristic.SetDuration, this.getSetDuration()), 100);
      });

    const options = this.configDev.E1_options;

    // Program switches
    const configured = new Map<string, { mode: number; name?: string }>();
    for (const program of options?.programSwitches ?? []) {
      const mode = Number(Object.keys(E1Modes).find((code) => E1Modes[Number(code)] === program.mode));
      if (!Number.isInteger(mode) || mode === 0) {
        this.platform.log.warn(`[${this.device.name}] Unknown dishwasher program "${program.mode}", ignoring it.`);
        continue;
      }
      configured.set(`${programSubtypePrefix}${program.mode}`, { mode, name: program.name });
    }
    for (const service of [...this.accessory.services]) {
      if (service.UUID === this.platform.Service.Switch.UUID && service.subtype?.startsWith(programSubtypePrefix) && !configured.has(service.subtype)) {
        this.accessory.removeService(service);
      }
    }
    for (const [subtype, { mode, name }] of configured) {
      const service =
        this.accessory.getServiceById(this.platform.Service.Switch, subtype) ?? this.accessory.addService(this.platform.Service.Switch, undefined, subtype);
      this.handleConfiguredName(service, subtype, name ?? E1Modes[mode]);
      service
        .getCharacteristic(this.platform.Characteristic.On)
        .onGet(() => this.isProgramRunning(mode))
        .onSet((value) => this.setProgram(mode, value));
      this.programSwitches.push({ mode, service });
    }

    // Salt / rinse aid shortage sensors (contact open = refill needed)
    this.saltSensorService = this.accessory.getServiceById(this.platform.Service.ContactSensor, saltSensorSubtype);
    if (options?.saltSensor) {
      this.saltSensorService ??= this.accessory.addService(this.platform.Service.ContactSensor, undefined, saltSensorSubtype);
      this.handleConfiguredName(this.saltSensorService, saltSensorSubtype, 'Salt');
      this.saltSensorService.getCharacteristic(this.platform.Characteristic.ContactSensorState).onGet(() => this.getShortage(this.device.attributes.SALT));
    } else if (this.saltSensorService) {
      this.accessory.removeService(this.saltSensorService);
      this.saltSensorService = undefined;
    }

    this.rinseAidSensorService = this.accessory.getServiceById(this.platform.Service.ContactSensor, rinseAidSensorSubtype);
    if (options?.rinseAidSensor) {
      this.rinseAidSensorService ??= this.accessory.addService(this.platform.Service.ContactSensor, undefined, rinseAidSensorSubtype);
      this.handleConfiguredName(this.rinseAidSensorService, rinseAidSensorSubtype, 'Rinse Aid');
      this.rinseAidSensorService
        .getCharacteristic(this.platform.Characteristic.ContactSensorState)
        .onGet(() => this.getShortage(this.device.attributes.RINSE_AID));
    } else if (this.rinseAidSensorService) {
      this.accessory.removeService(this.rinseAidSensorService);
      this.rinseAidSensorService = undefined;
    }
  }

  async updateCharacteristics(attributes: Partial<E1Attributes>) {
    let updateState = false;
    for (const [k, v] of Object.entries(attributes)) {
      this.platform.log.debug(`[${this.device.name}] Set attribute ${k} to: ${v}`);
      // Device attribute keys are upper case (POWER, STATUS, ...)
      switch (k.toLowerCase()) {
        case 'power':
        case 'status':
        case 'mode':
        case 'start':
        case 'time_remaining':
        case 'progress':
          updateState = true;
          break;
        case 'salt':
          this.saltSensorService?.updateCharacteristic(this.platform.Characteristic.ContactSensorState, this.getShortage(this.device.attributes.SALT));
          break;
        case 'rinse_aid':
          this.rinseAidSensorService?.updateCharacteristic(this.platform.Characteristic.ContactSensorState, this.getShortage(this.device.attributes.RINSE_AID));
          break;
        default:
          this.platform.log.debug(`[${this.device.name}] Attempt to set unsupported attribute ${k} to ${v}`);
          break;
      }
    }
    if (updateState) {
      this.updateState();
    }
    this.runPendingIfReady();
  }

  private updateState() {
    this.service.updateCharacteristic(this.platform.Characteristic.Active, this.getActive());
    this.service.updateCharacteristic(this.platform.Characteristic.InUse, this.getInUse());
    this.service.updateCharacteristic(this.platform.Characteristic.RemainingDuration, this.getRemainingDuration());
    this.service.updateCharacteristic(this.platform.Characteristic.SetDuration, this.getSetDuration());
    for (const { mode, service } of this.programSwitches) {
      service.updateCharacteristic(this.platform.Characteristic.On, this.isProgramRunning(mode));
    }
  }

  // Sends a command once ready() holds and repeats it until done() holds,
  // without blocking the HomeKit handler. A newer command replaces the pending one.
  private whenReady(name: string, ready: () => boolean, done: () => boolean, run: () => Promise<void>) {
    this.cancelPending();
    const poll = setInterval(() => this.pollPending(), POLL_INTERVAL_MS);
    poll.unref?.();
    this.pendingCommand = { name, ready, done, run, deadline: Date.now() + READY_TIMEOUT_MS, poll };
    this.requestStatus();
  }

  private pollPending() {
    const pending = this.pendingCommand;
    if (!pending) {
      return;
    }
    if (Date.now() >= pending.deadline) {
      this.cancelPending();
      this.platform.log.error(`[${this.device.name}] ${pending.name} failed: no response from the dishwasher in time.`);
      this.updateState();
      return;
    }
    // The dishwasher only reports changed values, so retry from here as well.
    this.runPendingIfReady();
    this.requestStatus();
  }

  private requestStatus() {
    // The response is handled by the device listener and ends up in updateCharacteristics().
    this.device.refresh_status().catch((e) => this.platform.log.debug(`[${this.device.name}] Status query failed: ${e}`));
  }

  private runPendingIfReady() {
    const pending = this.pendingCommand;
    if (!pending) {
      return;
    }
    if (pending.lastRun !== undefined && pending.done()) {
      this.cancelPending();
      return;
    }
    const now = Date.now();
    if (!pending.ready() || (pending.lastRun !== undefined && now - pending.lastRun < POLL_INTERVAL_MS)) {
      return;
    }
    pending.lastRun = now;
    pending.run().catch((e) => {
      if (this.pendingCommand === pending) {
        this.cancelPending();
      }
      this.platform.log.error(`[${this.device.name}] ${pending.name} failed: ${e}`);
      this.updateState();
    });
  }

  private cancelPending() {
    if (this.pendingCommand) {
      clearInterval(this.pendingCommand.poll);
      this.pendingCommand = undefined;
    }
  }

  // Powered on, not off and no program delayed or running.
  private isIdle(): boolean {
    const status = this.device.attributes.STATUS;
    return this.device.attributes.POWER && status !== undefined && status !== E1Status.OFF && !this.isRunning();
  }

  private isRunning(): boolean {
    const status = this.device.attributes.STATUS;
    return status === E1Status.DELAY || status === E1Status.RUNNING;
  }

  private isProgramRunning(mode: number): boolean {
    return this.isRunning() && this.device.attributes.MODE === mode;
  }

  private getShortage(shortage: boolean): CharacteristicValue {
    return shortage ? this.platform.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED : this.platform.Characteristic.ContactSensorState.CONTACT_DETECTED;
  }

  getActive(): CharacteristicValue {
    return this.device.attributes.POWER ? this.platform.Characteristic.Active.ACTIVE : this.platform.Characteristic.Active.INACTIVE;
  }

  async setActive(value: CharacteristicValue) {
    if (value === this.platform.Characteristic.Active.ACTIVE) {
      this.cancelPending();
      await this.device.set_attribute({ POWER: true });
    } else {
      await this.powerOff();
    }
  }

  private async powerOff() {
    // A power off request is ignored while a program is delayed or running,
    // so cancel the program first and power off once it has settled.
    if (this.isRunning()) {
      this.cancelPending();
      await this.device.cancel_work();
      this.whenReady(
        'Power off',
        () => !this.isRunning(),
        () => !this.device.attributes.POWER,
        () => this.device.set_attribute({ POWER: false }),
      );
    } else {
      this.cancelPending();
      await this.device.set_attribute({ POWER: false });
    }
  }

  private async setProgram(mode: number, value: CharacteristicValue) {
    const startName = `Start ${E1Modes[mode]}`;
    if (value) {
      this.cancelPending();
      if (this.isProgramRunning(mode)) {
        return;
      }
      if (this.isIdle()) {
        await this.device.set_work_mode(mode);
        return;
      }
      if (this.isRunning()) {
        // Another program is delayed or running: cancel it first.
        await this.device.cancel_work();
      } else if (!this.device.attributes.POWER) {
        await this.device.set_attribute({ POWER: true });
      }
      // The program is accepted only once the dishwasher is powered on and idle.
      this.whenReady(
        startName,
        () => this.isIdle(),
        () => this.isProgramRunning(mode),
        () => this.device.set_work_mode(mode),
      );
    } else if (this.isProgramRunning(mode) || this.pendingCommand?.name === startName) {
      // Also drop a start that is still waiting for the dishwasher, so that the
      // program does not start after its switch was turned off.
      await this.powerOff();
    }
  }

  getInUse(): CharacteristicValue {
    // In use only while a program is delayed or running, not just while powered on.
    return this.isRunning() ? this.platform.Characteristic.InUse.IN_USE : this.platform.Characteristic.InUse.NOT_IN_USE;
  }

  getRemainingDuration(): CharacteristicValue {
    return this.isRunning() ? (this.device.attributes.TIME_REMAINING ?? 0) * 60 : 0; // in seconds
  }

  getSetDuration(): CharacteristicValue {
    const remaining = this.getRemainingDuration() as number;
    if (remaining === 0) {
      this.runDuration = 0;
    } else if (remaining > this.runDuration) {
      this.runDuration = remaining;
    }
    return this.runDuration;
  }
}
