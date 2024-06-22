# Air Conditioner

Providing air conditioner settings is optional and the whole section or individual options may be ommitted and default values (noted below) will be used. Within the *devices.config* object the following air conditioner specific options.

```json
"AC_options": {
    "swing": {
        "mode": "None",
        "angleAccessory": false,
        "angleMainControl": "Vertical"
    },
    "heatingCapable": true,
    "outDoorTemp": false,
    "audioFeedback": false,
    "ecoSwitch": false,
    "dryModeSwitch": false,
    "breezeAwaySwitch": false,
    "displaySwitch": {
        "flag": true,
        "command": false
    },
    "auxHeatingSwitches": false,
    "minTemp": 16,
    "maxTemp": 30,
    "tempStep": 1,
    "fahrenheit": false,
    "fanOnlyModeSwitch": false,
    "fanAccessory": false
}
```
## Options
- **swing**:
  - **mode** *(optional)*: Set swing mode of the unit. If your unit does not support this feature then leave it on `None`. Default is `None`.
  - **angleAccessory** *(optional)*: Toggles if the swing angle accessory is created with the accessory. The accessory can be used to set the angle of the slat to a specified value. The `mode` property will be used to determine the direction of the slat. The main position bar will be used to set the angle of the direction which is selected in the `mode` property. Default is `false`.
  - **angleMainControl** *(optional)*: If `mode` property is Both and the swing angle accessory is enabled, this property will be used to determine which direction will be controlled by the main position bar of the accessory. Default is `Vertical`.
- **heatingCapable** *(optional)*: Toggles if the unit is capable of heating. Default is `true`.
- **outDoorTemp** *(optional)*: Toggles if the outdoor temperature sensor is created with the accessory. Default is `false`.
- **audioFeedback** *(optional)*: Toggles if the unit beeps when a command is sent, default is false.
- **ecoSwitch** *(optional)*: Toggles if the eco switch is created with the accessory. Default is `false`.
- **dryModeSwitch** *(optional)*: Toggles if the dry mode switch is created with the accessory. Default is `false`.
- **breezeAwaySwitch** *(optional)*: Toggles if the breeze away switch is created with the accessory. Default is `false`.
- **displaySwitch**:
  - **flag** *(optional)*: Toggles if a switch, which can turn the display on or off will be created or not. Default is `true`.
  - **command** *(optional)*: Use this if the switch display command does not work. If it doesn't work either way then you unit does not support this feature. Default is `false`. 
- **auxHeatingSwitches** *(optional)*: Toggles if the aux heating switches are created with the accessory. Default is `false`.
- **minTemp** *(optional)*: The minimum temperature that the unit can be set for.  Default is `16 celsius`
- **maxTemp** *(optional)*: The maximum temperature that the unit can be set for.  Default is `30 celsius`
- **tempStep** *(optional)*: Increment in which the temperature setting can be changed, may be set to either 0.5 or 1 degree celsius. The default is `1 degree`.
- **fahrenheit** *(optional)*: Toggles if the temperature on the unit is displayed in Fahrenheit or Celsius. Default is `false` (displays in Celsius).
- **fanOnlyModeSwitch** *(optional)*: Toggles if the fan only mode switch is created with the accessory. Default is `false`.
- **fanAccessory** *(optional)*: Toggles if the fan accessory is created with the accessory. Default is `false`.