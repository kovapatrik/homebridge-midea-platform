import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import { ACMode, SwingAngle, defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

function createDevice() {
  const device = new MideaACDevice(
    logger,
    {
      ip: '127.0.0.1',
      port: 6444,
      id: 1,
      model: 'test',
      sn: 'test',
      name: 'Test AC',
      type: DeviceType.AIR_CONDITIONER,
      version: ProtocolVersion.V2,
    },
    structuredClone(defaultConfig),
    structuredClone(defaultDeviceConfig),
  );
  const sent = [];
  device.build_send = async (message) => {
    sent.push(message);
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { device, sent };
}

// HomeKit scenes invoke every characteristic handler in the same tick, so the
// helper's send is still pending when set_attribute builds its full-state message.
test('swing set in the same scene as power/mode is not overwritten', async () => {
  const { device, sent } = createDevice();

  await Promise.all([device.set_swing(false, true), device.set_attribute({ POWER: true, MODE: ACMode.COOLING })]);

  assert.equal(sent.at(-1).swing_vertical, true);
  assert.equal(sent.at(-1).power, true);
});

test('target temperature set in the same scene as power/mode is not overwritten', async () => {
  const { device, sent } = createDevice();

  await Promise.all([device.set_target_temperature(21), device.set_attribute({ POWER: true, MODE: ACMode.COOLING })]);

  assert.equal(sent.at(-1).target_temperature, 21);
});

test('swing angle set in the same scene does not re-enable swing', async () => {
  const { device, sent } = createDevice();
  device.attributes.SWING_VERTICAL = true;

  await Promise.all([device.set_swing_angle(SwingAngle.VERTICAL, 50), device.set_attribute({ POWER: true, MODE: ACMode.COOLING })]);

  assert.equal(sent.at(-1).swing_vertical, false);
  assert.equal(device.attributes.WIND_SWING_UD_ANGLE, 50);
});

test('only the helper attributes are rolled back when the send fails', async () => {
  const { device } = createDevice();
  device.attributes.TARGET_TEMPERATURE = 24;
  device.build_send = async () => {
    await new Promise((resolve) => setImmediate(resolve));
    throw new Error('write failed');
  };

  const failed = device.set_target_temperature(21);
  device.attributes.FAN_SPEED = 60;

  await assert.rejects(failed, /write failed/);
  assert.equal(device.attributes.TARGET_TEMPERATURE, 24);
  assert.equal(device.attributes.FAN_SPEED, 60);
});
