import SmartLockDevice from "./device";

const {OAuth2Driver} = require('homey-oauth2app');
import LoqedOAuth2Client, { BoltState, Lock } from "../../lib/LoqedOAuth2Client";
import { Device } from "homey";

interface KeyStateParams {
  key: {
    name: string
  }
  boltState: BoltState
}

interface OnPairListProps {
  oAuth2Client: typeof LoqedOAuth2Client;
}

module.exports = class TouchSmartLockDriver extends OAuth2Driver {
  async onOAuth2Init() {
    this._keyStateTrigger = this.homey.flow.getDeviceTriggerCard("key_state")
      .registerRunListener(async (args: KeyStateParams, state: KeyStateParams) => {
        return args.key.name === state.key.name && args.boltState === state.boltState;
      })
      .registerArgumentAutocompleteListener(
        "key",
        async (query: string, args: any) => {
          const device: typeof SmartLockDevice = args.device;
          const oauth2Client: LoqedOAuth2Client = device.oAuth2Client;
          const deviceId = device.getData().id;
          const keys = await oauth2Client.getKeys(deviceId);

          return keys.data.filter((key) => key.administrator_name.toLowerCase().includes(query.toLowerCase())).map((key) => {
            return {
              name: key.administrator_name,
              id: key.name
            };
          })
        }
      );
  }

  async onPairListDevices({oAuth2Client}: OnPairListProps) {
    const devices: { data: Lock[] } = await oAuth2Client.getLocks();

    return devices.data.map(device => {
      return {
        name: device.name,
        data: device
      };
    });
  }

  async triggerUserStateFlow(device: Device, state: KeyStateParams) {
    this._keyStateTrigger
      .trigger(device, {}, state)
      .then(this.log)
      .catch(this.error);
  }
}
