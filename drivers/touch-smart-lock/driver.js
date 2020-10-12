'use strict';

const Homey = require('homey');
const {ManagerCloud} = require('homey');
const SHA256 = require('crypto-js/sha256');
const Base64 = require('crypto-js/enc-base64');
const cheerio = require('cheerio')
const Util = require('/lib/util');

class TouchSmartLockDriver extends Homey.Driver {
  async onInit() {
    const homeyId = await ManagerCloud.getHomeyId();
    this.util = new Util({ homey: this.homey });
    this.webhookUrl = `https://${(homeyId)}.connect.athom.com/API/app/com.loqed.touch-smart-lock`;

    new Homey.FlowCardAction('change_lock_state').register().registerRunListener(args => {
      args.device.changeLockState(args.lockState);

      return Promise.resolve();
    });
  }

  async onPair(socket) {
    let encryptedPassword = '';
    let password = '';
    let email = '';
    let foundDevices = [];

    socket.on('login', (data, callback) => {
      password = data.password.trim();
      encryptedPassword = Base64.stringify(SHA256(password));
      email = data.username.trim();

      this.getLocks(email, encryptedPassword)
        .then(devices => {
          foundDevices = devices;

          callback(null, true);
        })
        .catch(_ => callback(null, false));
    });

    socket.on('list_devices', function (data, callback) {
      callback(null, foundDevices);
    });

    socket.on('create_hooks', (data, callback) => {
      const device = data[0];

      this.createWebhook(device.data.id, email, encryptedPassword, password);
      setTimeout(_ => {
        this.createKey(device.data.id, email, encryptedPassword, password);
        this.getDeviceAuthData(device, email, encryptedPassword, password)
          .then(device => callback(null, device));
      }, 1000)
    })
  }

  async getLocks(email, encryptedPassword) {
    return new Promise((resolve, reject) => {
      this.util
        .callLoqedSite('webhook-edit', {
          email: email,
          password: encryptedPassword,
        })
        .then(res => {
          const $ = cheerio.load(res.data);
          const devices = [];

          if (res.data.includes('Incorrect username or password, please try again.')) {
            reject('Incorrect username or password, please try again.');
          }

          $('option').each(function () {
            devices.push({
              name: $(this).text().match('"(.*)",')[1],
              data: {
                id: parseInt($(this).val()),
              },
            });
          });

          resolve(devices);
        })
        .catch(err => reject(err));
    });
  }

  async getDeviceAuthData(device, email, encryptedPassword, password) {
    return new Promise((resolve, reject) => {
      setTimeout(_ => {
        this.util
          .callLoqedSite('webhook-list', {
            email: email,
            password: encryptedPassword,
            password_orig: password
          })
          .then(response => {
            const $ = cheerio.load(response.data);
            const webhookData = $(`table[data-id="${device.data.id}"]`).data();

            if (webhookData === undefined) {
              reject();
            }

            device.settings = {
              apiKey: webhookData.apiKey,
              apiToken: webhookData.apiToken,
              localKeyId: webhookData.localKeyId
            };

            return resolve(device);
          });
      }, 15000);
    })
  }

  createKey(deviceId, email, encryptedPassword, password) {
    this.util
      .callLoqedSite('key-update', {
        email: email,
        password: encryptedPassword,
        password_orig: password,
        name: 'Homey',
        lock_id: deviceId,
        p_remote: 'Checked',
        p_admin: '',
        p_pin: '',
        p_auto_unlock: '',
        p_touch: '',
        p_valid_from: '',
        p_valid_to: '',
      })
      .then(data => console.log(data))
      .catch(data => console.log(data));
  }

  createWebhook(deviceId, email, encryptedPassword, password) {
    this.util
      .callLoqedSite('webhook-update', {
        email: email,
        password: encryptedPassword,
        password_orig: password,
        lock_id: deviceId,
        url: this.webhookUrl,
        trigger_state_changed_open: 'checked',
        trigger_state_changed_latch: 'checked',
        trigger_state_changed_night_lock: 'checked',
      })
      .then(data => console.log(data));
  }
}

module.exports = TouchSmartLockDriver;
