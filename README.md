# Still in development! Needs testing!
The plugin only supports Midea SmartHome (formerly Midea MSmartHome) accounts and applications. You must have the devices assigned to the account which you will use in the plugin.

If anyone wants to contribute, you are welcome to do so! Because the plugin is almost identical with [midea_ac_lan](https://github.com/georgezhao2010/midea_ac_lan), you can create any device within this plugin.  
Also, my TCP socket knowledge (especially in Node.js) is kinda bad, so if you have any more idea how to reconnect in case of connection is lost, or when there is any error in the TCP connection, I will thank you!
# Usage
**Make sure you setup the plugin as a child bridge! (Plugins->Homebridge Midea->The wrench icon->Bridge Settings->Toggle the platform)**  
In the plugin's config you have to provide the IP of your Midea device, so it's highly recommended to reserve an IP for the devices you need. There is also a discover functionality, but I didn't tested it fully yet.
# About the plugin
The plugin is almost a one-to-one copy of [midea_ac_lan](https://github.com/georgezhao2010/midea_ac_lan), so huge props to [@georgezhao2010](https://github.com/georgezhao2010)!
I've just figured how to do some Python specific (or Python package specific) things in Node.js and wrote the Homebridge plugin for it.
