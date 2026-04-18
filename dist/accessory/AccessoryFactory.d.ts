import type MideaDevice from '../core/MideaDevice.js';
import type { MideaAccessory, MideaPlatform } from '../platform.js';
import type { DeviceConfig } from '../platformUtils.js';
import AirConditionerAccessory from './AirConditionerAccessory.js';
import DehumidifierAccessory from './DehumidifierAccessory.js';
import FrontLoadWasherAccessory from './FrontLoadWasherAccessory.js';
import ElectricWaterHeaterAccessory from './ElectricWaterHeaterAccessory.js';
import GasWaterHeaterAccessory from './GasWaterHeaterAccessory.js';
import FanAccessory from './FanAccessory.js';
import DishwasherAccessory from './DishwasherAccessory.js';
import HeatPumpWiFiControllerAccessory from './HeatPumpWiFiControllerAccessory.js';
import HumidifierAccessory from './HumidifierAccessory.js';
import FreshAirApplianceAccessory from './FreshAirApplianceAccessory.js';
import HeatPumpWaterHeaterAccessory from './HeatPumpWaterHeaterAccessory.js';
export default class AccessoryFactory {
    static createAccessory<T extends MideaDevice>(platform: MideaPlatform, accessory: MideaAccessory, device: T, configDev: DeviceConfig): AirConditionerAccessory | DehumidifierAccessory | FrontLoadWasherAccessory | ElectricWaterHeaterAccessory | GasWaterHeaterAccessory | FanAccessory | DishwasherAccessory | HeatPumpWiFiControllerAccessory | HumidifierAccessory | FreshAirApplianceAccessory | HeatPumpWaterHeaterAccessory;
}
