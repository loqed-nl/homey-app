module.exports = {
  async updateLockState({ homey, params, query, body }) {
    var parsedJson = body;

    return homey.app.setLockState(parsedJson.lock_id, parsedJson.requested_state, parsedJson.key_account_email);
  },
};
