import LoqedOAuth2Client, { BoltState } from "../../lib/LoqedOAuth2Client";
import { WebhookMessage } from "../../lib/LoqedApp";

const {OAuth2Device} = require('homey-oauth2app');

const SmartLockDevice = class SmartLockDevice extends OAuth2Device {
  async onOAuth2Init() {
    const oAuth2Client: LoqedOAuth2Client = this.oAuth2Client;
    const {id} = this.getData();

    await oAuth2Client.createWebhook(id);

    this.registerCapabilityListener('locked', async (value: any) => {
      return oAuth2Client.changeBoltState(id, (value ? BoltState.NIGHT_LOCK : BoltState.DAY_LOCK));
    });

    this.registerCapabilityListener('open', (value: any) => {
      return oAuth2Client.changeBoltState(id, BoltState.OPEN);
    });
  }

  async onWebhook(body: WebhookMessage) {
    const lockState = body.requested_state;
    const batteryPercentage = body.battery_percentage;
    const keyNameAdmin = body.key_name_admin;
    const openedTrigger = this.homey.flow.getTriggerCard('opened');

    if (lockState && keyNameAdmin) {
      await this.driver.triggerUserStateFlow(this, {key: {name: keyNameAdmin}, boltState: lockState});
    }

    if (lockState && (lockState === BoltState.OPEN || lockState === BoltState.DAY_LOCK)) {
      await openedTrigger.trigger(this)
      await this.setCapabilityValue('locked', false);
    }

    if (lockState && lockState === BoltState.NIGHT_LOCK) {
      await this.setCapabilityValue('locked', true);
    }

    if (batteryPercentage) {
      await this.setCapabilityValue('measure_battery', batteryPercentage);
    }
  }
};

module.exports = SmartLockDevice;
export default SmartLockDevice;
