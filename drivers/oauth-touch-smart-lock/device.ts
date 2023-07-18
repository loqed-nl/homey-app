import LoqedOAuth2Client, { BoltState } from "../../lib/LoqedOAuth2Client";
import { WebhookMessage } from "../../lib/LoqedApp";

const {OAuth2Device} = require('homey-oauth2app');
const HAS_WEBHOOK_KEY = 'has_webhook';
const SYNC_INTERVAL = 1000 * 60 * 5;

const SmartLockDevice = class SmartLockDevice extends OAuth2Device {
  private syncInterval: NodeJS.Timer | undefined;
  private openHouseMode: boolean = false;

  async onOAuth2Init() {
    const oAuth2Client: LoqedOAuth2Client = this.oAuth2Client;
    const {id} = this.getData();

    if (! this.getStoreValue(HAS_WEBHOOK_KEY)) {
      await oAuth2Client.createWebhook(id).then(() => {
        this.setStoreValue(HAS_WEBHOOK_KEY, true);
      });
    }

    this.registerCapabilityListener('locked', async (value: any) => {
      const lockState = (value ? BoltState.NIGHT_LOCK : BoltState.DAY_LOCK);

      await this.changeLockState(lockState);
      return oAuth2Client.changeBoltState(id, lockState);
    });

    this.registerCapabilityListener('lock_state', async (value: BoltState) => {
      await this.setCapabilityValue('locked', value === BoltState.NIGHT_LOCK);

      return oAuth2Client.changeBoltState(id, value);
    });

    await this.sync(true);
    this.syncInterval = setInterval(async () => await this.sync(false), SYNC_INTERVAL);
  }
  async onOAuth2Deleted() {
    await this.setStoreValue(HAS_WEBHOOK_KEY, false)

    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }

  async onWebhook(body: WebhookMessage) {
    const lockState = body.requested_state;
    const batteryPercentage = body.battery_percentage;
    const keyNameAdmin = body.key_name_admin;
    const openedTrigger = this.homey.flow.getTriggerCard('opened');

    if (lockState && keyNameAdmin) {
      await this.changeLockState(lockState);
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

  async sync(init: boolean) {
    const {battery_percentage, supported_lock_states, guest_access_mode, online} = await this.driver.getDeviceInfo(this);

    await (online ? this.setAvailable() : this.setUnavailable('The device is offline'));

    if (battery_percentage) {
      await this.setCapabilityValue('measure_battery', battery_percentage);
    }

    if (init) {
      this.openHouseMode = guest_access_mode;

      if (! this.hasCapability('lock_state') && supported_lock_states.length > 2) {
        await this.addCapability('lock_state');
      }

      if (this.hasCapability('lock_state') && supported_lock_states.length <= 2) {
        await this.removeCapability('lock_state');
      }

      return;
    }

    if (guest_access_mode !== this.openHouseMode) {
      this.openHouseMode = guest_access_mode;

      return this.driver.triggerOpenHouseModeFlow(this, {mode: guest_access_mode ? 'enabled' : 'disabled'})
    }
  }

  public async changeLockState(lockState: BoltState) {
    if (this.hasCapability('lock_state')) {
      return this.setCapabilityValue('lock_state', lockState);
    }

    return;
  }
};

module.exports = SmartLockDevice;
export default SmartLockDevice;
