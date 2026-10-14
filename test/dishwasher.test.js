import assert from 'node:assert/strict';
import test from 'node:test';
import { Accessory, Characteristic, Service, uuid } from '@homebridge/hap-nodejs';
import DishwasherAccessory from '../src/accessory/DishwasherAccessory.ts';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaE1Device, { E1Status } from '../src/devices/e1/MideaE1Device.ts';
import { MessageWork } from '../src/devices/e1/MideaE1Message.ts';
import { defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

function createDevice(deviceConfig = structuredClone(defaultDeviceConfig)) {
  const device = new MideaE1Device(
    logger,
    {
      ip: '127.0.0.1',
      port: 6444,
      id: 1,
      model: 'test',
      sn: 'test',
      name: 'Dishwasher',
      type: DeviceType.DISHWASHER,
      version: ProtocolVersion.V3,
    },
    structuredClone(defaultConfig),
    deviceConfig,
  );
  const sent = [];
  device.build_send = async (message) => {
    sent.push(message);
  };
  return { device, sent };
}

function createAccessory(e1Options = {}) {
  const deviceConfig = structuredClone(defaultDeviceConfig);
  deviceConfig.E1_options = { ...deviceConfig.E1_options, ...e1Options };
  const { device, sent } = createDevice(deviceConfig);
  const accessory = new Accessory('Dishwasher', uuid.generate('test-dishwasher'));
  accessory.context = {};
  const platform = { Service, Characteristic, log: logger };
  const handler = new DishwasherAccessory(platform, accessory, device, deviceConfig);
  return { accessory, device, handler, sent };
}

// Simulates a status report from the dishwasher.
function report(device, attributes) {
  Object.assign(device.attributes, attributes);
  device.update(attributes);
}

const workBodies = (sent) => sent.filter((m) => m instanceof MessageWork).map((m) => [...m._body]);

test('work message body matches midea-local', () => {
  const message = new MessageWork(ProtocolVersion.V3);
  message.mode = 0x04;
  assert.deepEqual([...message.body], [0x08, 0x03, 0x04, 0x00, 0x00]);
});

test('set_work_mode rejects unknown modes', async () => {
  const { device, sent } = createDevice();
  await assert.rejects(device.set_work_mode(0x11), /Unsupported work mode/);
  await assert.rejects(device.set_work_mode(0), /Unsupported work mode/);
  assert.equal(sent.length, 0);
});

test('cancel_work sends the cancel work status for the current mode', async () => {
  const { device, sent } = createDevice();
  device.attributes.MODE = 0x01;
  await device.cancel_work();
  assert.deepEqual(workBodies(sent), [[E1Status.CANCEL, 0x01, 0x00, 0x00]]);
});

test('status reports with upper case keys reach HomeKit', () => {
  const { accessory, device } = createAccessory();
  const valve = accessory.getService(Service.Valve);

  report(device, { POWER: true, STATUS: E1Status.RUNNING, MODE: 0x04, TIME_REMAINING: 230 });
  assert.equal(valve.getCharacteristic(Characteristic.Active).value, Characteristic.Active.ACTIVE);
  assert.equal(valve.getCharacteristic(Characteristic.InUse).value, Characteristic.InUse.IN_USE);
  assert.equal(valve.getCharacteristic(Characteristic.RemainingDuration).value, 230 * 60);
  assert.equal(valve.getCharacteristic(Characteristic.SetDuration).value, 230 * 60);

  // Program finished: still powered on, but no longer in use.
  report(device, { STATUS: E1Status.CANCEL, MODE: 0, TIME_REMAINING: 0 });
  assert.equal(valve.getCharacteristic(Characteristic.Active).value, Characteristic.Active.ACTIVE);
  assert.equal(valve.getCharacteristic(Characteristic.InUse).value, Characteristic.InUse.NOT_IN_USE);
  assert.equal(valve.getCharacteristic(Characteristic.RemainingDuration).value, 0);
});

test('program switches are created from config and unknown programs are skipped', () => {
  const { accessory } = createAccessory({
    programSwitches: [{ mode: 'eco_wash', name: 'Eco' }, { mode: 'fast_wash' }, { mode: 'bogus' }],
  });
  const subtypes = accessory.services.filter((s) => s.UUID === Service.Switch.UUID).map((s) => s.subtype);
  assert.deepEqual(subtypes, ['program_eco_wash', 'program_fast_wash']);
});

test('program switch starts the program and follows the device state', async () => {
  const { accessory, device, sent } = createAccessory({ programSwitches: [{ mode: 'eco_wash' }] });
  const program = accessory.getServiceById(Service.Switch, 'program_eco_wash');
  report(device, { POWER: true, STATUS: E1Status.CANCEL, MODE: 0 });

  await program.getCharacteristic(Characteristic.On).handleSetRequest(true);
  assert.deepEqual(workBodies(sent), [[0x03, 0x04, 0x00, 0x00]]);

  report(device, { STATUS: E1Status.RUNNING, MODE: 0x04 });
  assert.equal(program.getCharacteristic(Characteristic.On).value, true);
  report(device, { STATUS: E1Status.CANCEL, MODE: 0 });
  assert.equal(program.getCharacteristic(Characteristic.On).value, false);
});

test('turning the valve off while running cancels the program before powering off', async () => {
  const { accessory, device, sent } = createAccessory();
  const valve = accessory.getService(Service.Valve);
  report(device, { POWER: true, STATUS: E1Status.RUNNING, MODE: 0x01 });

  await valve.getCharacteristic(Characteristic.Active).handleSetRequest(Characteristic.Active.INACTIVE);
  assert.equal(sent.length, 2);
  assert.deepEqual([...sent[0]._body], [E1Status.CANCEL, 0x01, 0x00, 0x00]);
  assert.equal(sent[1].constructor.name, 'MessagePower');
  assert.equal(sent[1].power, false);
});

test('salt and rinse aid sensors open on shortage', () => {
  const { accessory, device } = createAccessory({ saltSensor: true, rinseAidSensor: true });
  const salt = accessory.getServiceById(Service.ContactSensor, 'saltSensor');
  const rinse = accessory.getServiceById(Service.ContactSensor, 'rinseAidSensor');
  report(device, { SALT: true, RINSE_AID: false });
  assert.equal(salt.getCharacteristic(Characteristic.ContactSensorState).value, Characteristic.ContactSensorState.CONTACT_NOT_DETECTED);
  assert.equal(rinse.getCharacteristic(Characteristic.ContactSensorState).value, Characteristic.ContactSensorState.CONTACT_DETECTED);
});

test('failed power command restores the previous state and is reported', async () => {
  const { device } = createDevice();
  device.build_send = async () => {
    throw new Error('write failed');
  };
  await assert.rejects(device.set_attribute({ POWER: true }), /write failed/);
  assert.equal(device.attributes.POWER, false);
});
