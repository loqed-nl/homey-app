import LoqedOAuth2Client, { BoltState, GuestAccessMode as GuestAccessMode } from "../../lib/LoqedOAuth2Client";
import { WebhookMessage } from "../../lib/LoqedApp";

const { OAuth2Device } = require('homey-oauth2app');
const HAS_WEBHOOK_KEY = 'has_webhook';
const SYNC_INTERVAL = 1000 * 60 * 5;

const SmartLockDevice = class SmartLockDevice extends OAuth2Device {
  private syncInterval: NodeJS.Timer | undefined;
  private guestAccessMode: boolean = false;

  onAdded() {
    const savedSessions = this.homey.app.getSavedOAuth2Sessions();

    const {
      OAuth2SessionId,
      OAuth2ConfigId,
    } = this.getStore();

    let sessionIds = Object.keys(savedSessions);
    for (let i = 0; i < sessionIds.length; i++) {
      const sessionId = sessionIds[i];
      if (sessionId !== OAuth2SessionId) {
        this.setStoreValue('OAuth2SessionId', sessionId);
        this.homey.app.deleteOAuth2Client({ sessionId: OAuth2SessionId })
      }
    }
  }

  async onOAuth2Init() {

    const oAuth2Client: LoqedOAuth2Client = this.oAuth2Client;
    const { id } = this.getData();

    if (!this.getStoreValue(HAS_WEBHOOK_KEY)) {
      await oAuth2Client.createWebhook(id).then(() => {
        this.setStoreValue(HAS_WEBHOOK_KEY, true);
      });
    }

    this.registerCapabilityListener('locked', async (value: any) => {
      const lockState = (value ? BoltState.NIGHT_LOCK : BoltState.DAY_LOCK);

      await this.changeOpen(lockState);
      return oAuth2Client.changeBoltState(id, lockState);
    });


    if (this.hasCapability('open')) this.registerCapabilityListener('open', async (value: Boolean) => {
      if (value) {
        await this.setCapabilityValue('locked', false);

        return oAuth2Client.changeBoltState(id, BoltState.OPEN);
      }
    });


    // this.registerCapabilityListener('lock_state', async (value: BoltState) => {
    //   await this.setCapabilityValue('locked', value === BoltState.NIGHT_LOCK);

    //   return oAuth2Client.changeBoltState(id, value);
    // });


    // this.registerCapabilityListener('house_open_button', async (value: GuestAccessMode) => {
    //   return oAuth2Client.changeGuestAccessMode(id, value);
    // });


    this.sync(true);
    this.syncInterval = this.homey.setInterval(async () => await this.sync(false), SYNC_INTERVAL);
  }
  async onOAuth2Deleted() {
    await this.setStoreValue(HAS_WEBHOOK_KEY, false)

    if (this.syncInterval) {
      this.homey.clearInterval(this.syncInterval);
    }
  }

  async onWebhook(body: WebhookMessage) {
    //this.log('webhook body', body);
    const boltState = body.requested_state;
    const batteryPercentage = body.battery_percentage;
    const keyNameAdmin = body.key_name_admin;
    const event_type = body.event_type;

    if (event_type && event_type.startsWith('STATE_CHANGED_'))
      await this.setBoltState(boltState, keyNameAdmin);

    if (batteryPercentage) {
      await this.setCapabilityValue('measure_battery', batteryPercentage);
    }
  }

  async setBoltState(boltState: BoltState | undefined, keyNameAdmin: string | undefined) {
    if (boltState) {
      this.setStoreValue('bolt_state', boltState);
      await this.changeOpen(boltState);
    }

    if (boltState && (boltState === BoltState.OPEN || boltState === BoltState.DAY_LOCK)) {
      await this.setCapabilityValue('locked', false);
    }

    if (boltState && boltState === BoltState.NIGHT_LOCK) {
      await this.setCapabilityValue('locked', true);
    }

    if (boltState && keyNameAdmin) {
      await this.driver.triggerUserStateFlow(this, { key: { name: keyNameAdmin }, boltState: boltState });
    }

    if (boltState && (boltState === BoltState.OPEN)) {
      await this.driver.triggerOpenedFlow(this);
    }

  }

  async sync(init: boolean) {
    const { battery_percentage, supported_lock_states, guest_access_mode, online, bolt_state } = await this.driver.getDeviceInfo(this);

    await (online ? this.setAvailable() : this.setUnavailable('The device is offline'));

    if (battery_percentage) {
      await this.setCapabilityValue('measure_battery', battery_percentage);
    }

    if (bolt_state && this.getStoreValue('bolt_state') !== bolt_state) {
      await this.setBoltState(bolt_state, undefined);
    }

    if (this.getStoreValue('guest_access_mode') !== guest_access_mode) {
      this.setStoreValue('guest_access_mode', guest_access_mode);
      this.driver.triggerGuestAccessModeFlow(this, { mode: guest_access_mode ? 'enabled' : 'disabled' }, { guest_access_mode }); //No need to await
    }
  }

  public async changeOpen(lockState: BoltState) {
    if (this.hasCapability('open')) {
      return this.setCapabilityValue('open', lockState === BoltState.OPEN);
    }

    return;
  }

  // public async changeLockState(lockState: BoltState) {
  //   if (this.hasCapability('lock_state')) {
  //     return this.setCapabilityValue('lock_state', lockState);
  //   }

  //   return;
  // }
};

module.exports = SmartLockDevice;
export default SmartLockDevice;
