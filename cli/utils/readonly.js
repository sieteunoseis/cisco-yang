"use strict";

const { checkWriteAllowed } = require("./confirm.js");

async function enforceReadOnly(globalOpts, operation) {
  const { getActiveDevice } = require("./config.js");
  const device = getActiveDevice(globalOpts.device);
  const deviceConfig = device || {};

  const config = {
    readOnly: globalOpts.readOnly || deviceConfig.readOnly || false,
  };

  await checkWriteAllowed(config, globalOpts);
}

module.exports = { enforceReadOnly };
