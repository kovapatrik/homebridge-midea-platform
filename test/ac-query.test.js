import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import { MessageNewProtocolQuery } from '../src/devices/ac/MideaACMessage.ts';
import { defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const SCREEN_DISPLAY_TAG = 0x0017;

const logger = {
  debug() {},
  error() {},
  info() {},
  warn() {},
};

function createDevice() {
  return new MideaACDevice(
    logger,
    {
      ip: '127.0.0.1',
      port: 6444,
      id: 1,
      model: 'test',
      sn: 'test',
      name: 'Test AC',
      type: DeviceType.AIR_CONDITIONER,
      version: ProtocolVersion.V3,
    },
    structuredClone(defaultConfig),
    structuredClone(defaultDeviceConfig),
  );
}

function getNewProtocolQueryTags(device) {
  const query = device.build_query().find((message) => message instanceof MessageNewProtocolQuery);
  assert.ok(query);

  const body = query._body;
  const count = body[0];
  assert.equal(body.length, 1 + count * 2);

  return Array.from({ length: count }, (_, index) => body.readUInt16LE(1 + index * 2));
}

test('only queries display status when the alternate display command is enabled', () => {
  const device = createDevice();
  assert.equal(getNewProtocolQueryTags(device).includes(SCREEN_DISPLAY_TAG), false);

  device.set_alternate_switch_display(true);
  assert.equal(getNewProtocolQueryTags(device).includes(SCREEN_DISPLAY_TAG), true);
});
