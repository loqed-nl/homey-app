import LoqedOAuth2Client, { BoltState, OpenHouseMode, SettingArgument, TouchToConnectMode, TwistAssistMode } from "../../lib/LoqedOAuth2Client";
import { WebhookMessage } from "../../lib/LoqedApp";

const { OAuth2Device } = require('homey-oauth2app');
const WEBHOOK_KEY = 'webhookId';
const SYNC_INTERVAL = 1000 * 60 * 5;

const SmartLockDevice = class SmartLockDevice extends OAuth2Device {
  private syncInterval: NodeJS.Timer | undefined;

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

  async onSettings({ oldSettings, newSettings, changedKeys }: SettingArgument) {

    if (this.hasCapability('open')) {
      let varOpenHouseMode = this.hasCapability('open_house_mode') ? this.getCapabilityValue('open_house_mode') : this.getCapabilityValue('open_house_mode_sensor');
      if (newSettings.open_house_mode_button) {
        if (this.hasCapability('open_house_mode_sensor')) await this.removeCapability('open_house_mode_sensor');
        if (!this.hasCapability('open_house_mode')) {
          await this.addCapability('open_house_mode');
          await this.setCapabilityValue('open_house_mode', varOpenHouseMode);
        }
      } else {
        if (!this.hasCapability('open_house_mode_sensor')) {
          await this.addCapability('open_house_mode_sensor');
          await this.setCapabilityValue('open_house_mode_sensor', varOpenHouseMode);
        }
        if (this.hasCapability('open_house_mode')) await this.removeCapability('open_house_mode');
      }
    } else if(newSettings.open_house_mode_button) throw new Error(this.homey.__('errors.cannot_set_open_house_mode_button'));

    let varTwistAssist = this.hasCapability('twist_assist') ? this.getCapabilityValue('twist_assist') : this.getCapabilityValue('twist_assist_sensor');
    if (newSettings.twist_assist_button) {
      if (this.hasCapability('twist_assist_sensor')) await this.removeCapability('twist_assist_sensor');
      if (!this.hasCapability('twist_assist')) {
        await this.addCapability('twist_assist');
        await this.setCapabilityValue('twist_assist', varTwistAssist);
      }
    } else {
      if (!this.hasCapability('twist_assist_sensor')) {
        await this.addCapability('twist_assist_sensor');
        await this.setCapabilityValue('twist_assist_sensor', varTwistAssist);
      }
      if (this.hasCapability('twist_assist')) await this.removeCapability('twist_assist');
    }

    let varTouchToConnect = this.hasCapability('touch_to_connect') ? this.getCapabilityValue('touch_to_connect') : this.getCapabilityValue('touch_to_connect_sensor');
    if (newSettings.touch_to_connect_button) {
      if (this.hasCapability('touch_to_connect_sensor')) await this.removeCapability('touch_to_connect_sensor');
      if (!this.hasCapability('touch_to_connect')) {
        await this.addCapability('touch_to_connect');
        await this.setCapabilityValue('touch_to_connect', varTouchToConnect);
      }
    } else {
      if (!this.hasCapability('touch_to_connect_sensor')) {
        await this.addCapability('touch_to_connect_sensor');
        await this.setCapabilityValue('touch_to_connect_sensor', varTouchToConnect);
      }
      if (this.hasCapability('touch_to_connect')) await this.removeCapability('touch_to_connect');
    }
  }

  async onOAuth2Init() {

    const oAuth2Client: LoqedOAuth2Client = this.oAuth2Client;
    const { id } = this.getData();
    //console.log(id);
    //this.unsetStoreValue(WEBHOOK_KEY);
    if(!this.hasCapability('open')) await this.setSettings({open_house_mode_button:false});

    if (!this.getStoreValue(WEBHOOK_KEY)) {
      await oAuth2Client.createWebhook(id).then((x) => {
        console.log('createWebhook x:\n', x);
        this.setStoreValue(WEBHOOK_KEY, x.data.id);
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
      } throw new Error(this.homey.__('errors.open_readonly'));
    });


    if (this.hasCapability('open_house_mode')) this.registerCapabilityListener('open_house_mode', async (value: OpenHouseMode) => {
      return await oAuth2Client.changeOpenHouseMode(id, value);
    });

    if (this.hasCapability('twist_assist')) this.registerCapabilityListener('twist_assist', async (value: TwistAssistMode) => {
      return await oAuth2Client.changeTwistAssist(id, value);
    });

    if (this.hasCapability('touch_to_connect')) this.registerCapabilityListener('touch_to_connect', async (value: TouchToConnectMode) => {
      return await oAuth2Client.changeTouchToConnect(id, value);
    });


    this.sync(true);
    this.syncInterval = this.homey.setInterval(async () => await this.sync(false), SYNC_INTERVAL);
  }

  async onOAuth2Uninit() {

    if (this.syncInterval) {
      this.homey.clearInterval(this.syncInterval);
    }
  }

  async onOAuth2Deleted() {
    let webHookId = this.getStoreValue(WEBHOOK_KEY);

    const oAuth2Client: LoqedOAuth2Client = this.oAuth2Client;
    const { id } = this.getData();

    if (webHookId) {
      await oAuth2Client.deleteWebhook(id, webHookId).then(async () => {
        await this.unsetStoreValue(WEBHOOK_KEY);
      });
    }

    if (this.syncInterval) {
      this.homey.clearInterval(this.syncInterval);
    }
  }
  async onWebhook(body: WebhookMessage) {
    this.log('webhook body:\n', body);
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
      await this.setCapabilityValue('locked', boltState === BoltState.NIGHT_LOCK);
      await this.changeOpen(boltState);
    }

    if (boltState && keyNameAdmin) {
      await this.driver.triggerUserStateFlow(this, { key: { name: keyNameAdmin }, boltState: boltState });
    }

    if (boltState && (boltState === BoltState.OPEN)) {
      await this.driver.triggerOpenedFlow(this);
    }

  }

  async sync(init: boolean) {
    try {
      let deviceInfo = await this.driver.getDeviceInfo(this);
      if (!deviceInfo) return;
      this.log('deviceInfo:\n', deviceInfo);
      let { battery_percentage, supported_lock_states, open_house_mode, online, bolt_state, twist_assist, touch_to_connect } = deviceInfo;

      await (online ? this.setAvailable() : this.setUnavailable('The device is offline'));

      if (battery_percentage !== undefined && battery_percentage !== null) {
        if (battery_percentage < 0) battery_percentage = 0;
        await this.setCapabilityValue('measure_battery', battery_percentage);
      }

      let lockedCapabilityValue = this.getCapabilityValue('locked');
      let oldBoltState = lockedCapabilityValue === true ? BoltState.NIGHT_LOCK : lockedCapabilityValue === false ? BoltState.DAY_LOCK : undefined;

      if (this.hasCapability('open') && this.getCapabilityValue('open') === true) oldBoltState = BoltState.OPEN;

      if (bolt_state && oldBoltState !== bolt_state) {
        await this.setBoltState(bolt_state, undefined);
      }

      await this.setOpenHouseMode(open_house_mode, true);
      await this.setTwistAssist(twist_assist, true);
      await this.setTouchToConnect(touch_to_connect, true);


    } catch (error) {
      this.error(error);
    }
  }

  public async changeOpen(lockState: BoltState) {
    if (this.hasCapability('open')) {
      return this.setCapabilityValue('open', lockState === BoltState.OPEN);
    }

    return;
  }

  public async setOpenHouseMode(open_house_mode: Boolean, triggerFlow: Boolean) {
    let varOpenHouseMode = this.hasCapability('open_house_mode') ? this.getCapabilityValue('open_house_mode') : this.getCapabilityValue('open_house_mode_sensor');
    if (varOpenHouseMode !== open_house_mode) {
      if (this.hasCapability('open_house_mode')) await this.setCapabilityValue('open_house_mode', open_house_mode);
      if (this.hasCapability('open_house_mode_sensor')) await this.setCapabilityValue('open_house_mode_sensor', open_house_mode);
      if (triggerFlow) this.driver.triggerOpenHouseModeFlow(this, { open_house_mode: open_house_mode ? 'enabled' : 'disabled' }, { open_house_mode });
    }
  }
  public async setTwistAssist(twist_assist: Boolean, triggerFlow: Boolean) {
    let varTwistAssist = this.hasCapability('twist_assist') ? this.getCapabilityValue('twist_assist') : this.getCapabilityValue('twist_assist_sensor');
    if (varTwistAssist !== twist_assist) {
      if (this.hasCapability('twist_assist')) await this.setCapabilityValue('twist_assist', twist_assist);
      if (this.hasCapability('twist_assist_sensor')) await this.setCapabilityValue('twist_assist_sensor', twist_assist);
      if (triggerFlow) this.driver.triggerTwistAssistFlow(this, { twist_assist: twist_assist ? 'enabled' : 'disabled' }, { twist_assist });
    }
  }
  public async setTouchToConnect(touch_to_connect: Boolean, triggerFlow: Boolean) {
    let varTouchToConnect = this.hasCapability('touch_to_connect') ? this.getCapabilityValue('touch_to_connect') : this.getCapabilityValue('touch_to_connect_sensor');
    if (varTouchToConnect !== touch_to_connect) {
      if (this.hasCapability('touch_to_connect')) await this.setCapabilityValue('touch_to_connect', touch_to_connect);
      if (this.hasCapability('touch_to_connect_sensor')) await this.setCapabilityValue('touch_to_connect_sensor', touch_to_connect);
      if (triggerFlow) this.driver.triggerTouchToConnectFlow(this, { touch_to_connect: touch_to_connect ? 'enabled' : 'disabled' }, { touch_to_connect });
    }
  }

};

module.exports = SmartLockDevice;
export default SmartLockDevice;
