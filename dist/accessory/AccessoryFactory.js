import { DeviceType } from '../core/MideaConstants.js';
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
// biome-ignore lint/complexity/noStaticOnlyClass: static class is used for factory
export default class AccessoryFactory {
    static createAccessory(platform, accessory, device, configDev) {
        switch (device.type) {
            case DeviceType.DEHUMIDIFIER:
                return new DehumidifierAccessory(platform, accessory, device, configDev);
            case DeviceType.AIR_CONDITIONER:
                return new AirConditionerAccessory(platform, accessory, device, configDev);
            case DeviceType.HEAT_PUMP_WIFI_CONTROLLER:
                return new HeatPumpWiFiControllerAccessory(platform, accessory, device, configDev);
            case DeviceType.FRONT_LOAD_WASHER:
                return new FrontLoadWasherAccessory(platform, accessory, device, configDev);
            case DeviceType.DISHWASHER:
                return new DishwasherAccessory(platform, accessory, device, configDev);
            case DeviceType.ELECTRIC_WATER_HEATER:
                return new ElectricWaterHeaterAccessory(platform, accessory, device, configDev);
            case DeviceType.GAS_WATER_HEATER:
                return new GasWaterHeaterAccessory(platform, accessory, device, configDev);
            case DeviceType.FAN:
                return new FanAccessory(platform, accessory, device, configDev);
            case DeviceType.HUMIDIFIER:
                return new HumidifierAccessory(platform, accessory, device, configDev);
            case DeviceType.FRESH_AIR_APPLIANCE:
                return new FreshAirApplianceAccessory(platform, accessory, device, configDev);
            case DeviceType.HEAT_PUMP_WATER_HEATER:
                return new HeatPumpWaterHeaterAccessory(platform, accessory, device, configDev);
            default:
                throw new Error(`Unsupported device type: ${device.type}`);
        }
    }
}
//# sourceMappingURL=AccessoryFactory.js.map