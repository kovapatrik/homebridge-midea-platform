import assert from 'node:assert/strict';
import test from 'node:test';
import * as hap from '@homebridge/hap-nodejs';
import { DeviceType, ProtocolVersion } from '../src/core/MideaConstants.ts';
import MideaACDevice from '../src/devices/ac/MideaACDevice.ts';
import { MideaPlatform } from '../src/platform.ts';
import { ACMode, defaultConfig, defaultDeviceConfig } from '../src/platformUtils.ts';

const logger = { debug() {}, error() {}, info() {}, warn() {} };
const { Accessory, Characteristic, Service, uuid } = hap;

for (const connected of [false, true]) {
  test(`cached accessory retains handlers after ${connected ? 'successful' : 'failed'} startup`, async (t) => {
    const info = { id: 1, name: 'Test AC', ip: '127.0.0.1', port: 6444, type: DeviceType.AIR_CONDITIONER, version: ProtocolVersion.V3 };
    const accessory = new Accessory(info.name, uuid.generate(info.id.toString()));
    accessory.context = {};
    const service = accessory.addService(Service.HeaterCooler);
    service.setCharacteristic(Characteristic.HeatingThresholdTemperature, 21);
    service.setCharacteristic(Characteristic.CoolingThresholdTemperature, 24);
    const config = structuredClone(defaultDeviceConfig);
    config.AC_options.displaySwitch.flag = false;
    config.advanced_options.token = '00';
    config.advanced_options.key = '00';
    const register = t.mock.fn();
    const errors = t.mock.fn();
    const platform = Object.assign(Object.create(MideaPlatform.prototype), {
      Characteristic,
      Service,
      accessories: new Map([[accessory.UUID, accessory]]),
      discoveredCacheUUIDs: [],
      api: { hap, registerPlatformAccessories: register, updatePlatformAccessories() {} },
      log: { ...logger, error: errors },
      platformConfig: structuredClone(defaultConfig),
    });
    let device;
    t.mock.method(MideaACDevice.prototype, 'connect', async function () {
      device = this;
      return connected;
    });
    const open = t.mock.method(MideaACDevice.prototype, 'open', function () {
      assert.ok(this.listenerCount('update') > 0, 'attach handlers before starting retries');
    });
    t.after(() => device?.promiseSocket.destroy());

    await platform.addDevice(info, config);

    assert.deepEqual(
      errors.mock.calls.map((call) => call.arguments),
      [],
    );
    assert.equal(open.mock.callCount(), connected ? 0 : 1);
    assert.equal(device.listenerCount('update'), 1);
    assert.equal(device.listenerCount('error_refresh'), 1);
    if (!connected) {
      assert.notEqual(service.getCharacteristic(Characteristic.Active).statusCode, 0);
      assert.notEqual(service.getCharacteristic(Characteristic.CurrentTemperature).statusCode, 0);
    }

    const values = { POWER: true, MODE: ACMode.HEATING, TARGET_TEMPERATURE: 21, INDOOR_TEMPERATURE: 23 };
    Object.assign(device.attributes, values);
    device.emit('update', values);

    assert.equal(service.getCharacteristic(Characteristic.Active).value, 1);
    assert.equal(service.getCharacteristic(Characteristic.Active).statusCode, 0);
    assert.equal(service.getCharacteristic(Characteristic.CurrentTemperature).value, 23);
    assert.equal(service.getCharacteristic(Characteristic.CurrentTemperature).statusCode, 0);
    assert.equal(service.getCharacteristic(Characteristic.HeatingThresholdTemperature).value, 21);
    assert.equal(platform.accessories.get(accessory.UUID), accessory);
    assert.equal(register.mock.callCount(), 0);
  });
}
