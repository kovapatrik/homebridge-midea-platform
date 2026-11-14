/***********************************************************************
 * Eve custom characteristics for energy monitoring
 *
 * Apple's Home app has no characteristic for power or energy, so plugins use the ones
 * defined by Eve (also shown by the Eve app and other HomeKit clients).
 */
import type { API, Characteristic, WithUUID } from 'homebridge';

export type EveCharacteristics = {
  Consumption: WithUUID<new () => Characteristic>;
  TotalConsumption: WithUUID<new () => Characteristic>;
};

let cached: EveCharacteristics | undefined;

export function eveCharacteristics(api: API): EveCharacteristics {
  if (cached) {
    return cached;
  }
  const { Characteristic, Formats, Perms } = api.hap;

  // Instantaneous power, in watts
  class Consumption extends Characteristic {
    static readonly UUID = 'E863F10D-079E-48FF-8F27-9C2605A29F52';
    constructor() {
      super('Consumption', Consumption.UUID, {
        format: Formats.FLOAT,
        unit: 'W',
        minValue: 0,
        maxValue: 65535,
        minStep: 0.1,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }

  // Cumulative energy, in kWh
  class TotalConsumption extends Characteristic {
    static readonly UUID = 'E863F10C-079E-48FF-8F27-9C2605A29F52';
    constructor() {
      super('Total Consumption', TotalConsumption.UUID, {
        format: Formats.FLOAT,
        unit: 'kWh',
        minValue: 0,
        maxValue: 4294967295,
        minStep: 0.01,
        perms: [Perms.PAIRED_READ, Perms.NOTIFY],
      });
      this.value = this.getDefaultValue();
    }
  }

  cached = { Consumption, TotalConsumption };
  return cached;
}
