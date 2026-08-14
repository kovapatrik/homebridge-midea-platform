import assert from 'node:assert/strict';
import test from 'node:test';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import { MideaPlatform } from '../src/platform.ts';
import { defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

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

test('rejects V3 commands while unauthenticated', async () => {
  const device = createDevice();

  await assert.rejects(device.send_message(Buffer.alloc(0)), /not authenticated/);
});

test('restores AC attributes when a command fails', async () => {
  const device = createDevice();
  device.attributes.POWER = false;
  device.build_send = async () => {
    throw new Error('send failed');
  };

  await assert.rejects(device.set_attribute({ POWER: true }), /send failed/);
  assert.equal(device.attributes.POWER, false);
});

test('reports refresh errors to accessories', async () => {
  const device = createDevice();
  device.build_send = async () => {
    throw new Error('send failed');
  };
  const refreshError = new Promise((resolve) => device.once('error_refresh', resolve));

  assert.equal(await device.refresh_status(), false);
  await refreshError;
});

test('marks cached accessories unavailable when discovery misses them', (t) => {
  t.mock.method(globalThis, 'setTimeout', () => 0);
  let characteristicError;
  const mainService = {
    UUID: 'main-service',
    testCharacteristic: (characteristic) => characteristic === 'active',
    updateCharacteristic: (_characteristic, error) => {
      characteristicError = error;
    },
  };
  const platform = Object.assign(Object.create(MideaPlatform.prototype), {
    Characteristic: {
      Active: 'active',
      On: 'on',
      CurrentHeatingCoolingState: 'current-heating-cooling-state',
    },
    Service: { AccessoryInformation: { UUID: 'accessory-information' } },
    accessories: new Map([['device-1', { services: [{ UUID: 'accessory-information' }, mainService] }]]),
    api: { hap: { uuid: { generate: () => 'device-1' } } },
    discover: { startDiscover() {} },
    discoveredDevices: new Map(),
    discoveryInterval: 60,
    log: logger,
    platformConfig: { devices: [{ id: 1, name: 'Test AC' }] },
  });

  platform.discoveryComplete();

  assert.match(characteristicError.message, /Device not found/);
});
