### Wi-Fi Setup & Provisioning

If your Midea device is not connected to your Wi-Fi network, it cannot be discovered or controlled by this plugin. This guide explains how to get your device back online.

#### 1. Put the Device in AP Mode

To connect your device to Wi-Fi, you must first put it in **AP (Access Point)** mode.

- **For most Air Conditioners**: Press the **LED** or **Do Not Disturb** button on your remote control **7 times** within 10 seconds.
- The unit's display should show **"AP"**.
- The device will now broadcast its own Wi-Fi network (usually named `net_ac_xxxx` or `midea_ac_xxxx`).

#### 2. Provisioning (Connecting to your Home Wi-Fi)

Provisioning is the step where you send your Wi-Fi name and password to the device.

**Important Note**: Unlike discovery, there is currently no reliable and simple command-line tool for this step. Using the official app is **mandatory** to connect the device to your Wi-Fi for the first time.

1. Download the **NetHome Plus** or **Midea SmartHome** app.
2. Add a new device and follow the instructions to connect it to your 2.4GHz Wi-Fi.
3. Once the device is connected to your Wi-Fi (the Wi-Fi symbol on the unit becomes solid), it will be visible in Homebridge.
4. **Important**: Once connected, you don't have to keep the device linked to your personal account if you use the plugin's "Default Profile" option (see step 4).

#### 3. Common Issues

- **2.4GHz Only**: Midea Wi-Fi modules only support **2.4GHz** networks. Ensure your phone/server and the device are not trying to use 5GHz during setup.
- **Special Characters**: Avoid special characters in your Wi-Fi SSID or Password.
- **Distance**: Ensure the Wi-Fi signal is strong enough at the device location.

#### 4. Next Steps

Once your device is connected to your Wi-Fi (test it with a `ping` to its IP address):

1. Go to the Homebridge UI.
2. Use the **Discover** feature in the Midea Platform settings.
3. If you don't have a Midea account, check the **"Use default NetHome Plus profile"** option.
