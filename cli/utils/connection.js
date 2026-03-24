"use strict";

const {
  getActiveDevice,
  hasSsPlaceholders,
  resolveSsPlaceholders,
} = require("./config.js");

async function resolveConfig(flags = {}) {
  let cfgHost, cfgUsername, cfgPassword, cfgInsecure;

  const deviceName = flags.device || undefined;
  const device = getActiveDevice(deviceName);

  if (deviceName && !device) {
    throw new Error(`Device "${deviceName}" not found`);
  }

  if (device) {
    cfgHost = device.host;
    cfgUsername = device.username;
    cfgPassword = device.password;
    cfgInsecure = device.insecure;
  }

  const envHost = process.env.CISCO_YANG_HOST;
  const envUsername = process.env.CISCO_YANG_USERNAME;
  const envPassword = process.env.CISCO_YANG_PASSWORD;

  const flagHost = flags.host;
  const flagUsername = flags.username;
  const flagPassword = flags.password;
  const flagInsecure = flags.insecure;

  const host = flagHost || envHost || cfgHost;
  const username = flagUsername || envUsername || cfgUsername;
  const password = flagPassword || envPassword || cfgPassword;
  const insecure = flagInsecure !== undefined ? flagInsecure : cfgInsecure;

  if (!host) {
    throw new Error(
      "No device host configured. Provide --host, set CISCO_YANG_HOST, or add a device with: cisco-yang config add",
    );
  }
  if (!username) {
    throw new Error(
      "No username configured. Provide --username, set CISCO_YANG_USERNAME, or add a device with: cisco-yang config add",
    );
  }
  if (!password) {
    throw new Error(
      "No password configured. Provide --password, set CISCO_YANG_PASSWORD, or add a device with: cisco-yang config add",
    );
  }

  const result = { host, username, password };
  if (insecure !== undefined) {
    result.insecure = insecure;
  }

  if (hasSsPlaceholders(result)) {
    return resolveSsPlaceholders(result);
  }

  return result;
}

async function createService(flags = {}) {
  const config = await resolveConfig(flags);

  if (config.insecure || flags.insecure) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    process.emitWarning = ((orig) =>
      function (warning, ...args) {
        if (
          typeof warning === "string" &&
          warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")
        )
          return;
        return orig.call(process, warning, ...args);
      })(process.emitWarning);
  }

  const opts = { insecure: config.insecure };
  if (flags.debug) {
    opts.logging = { level: "debug" };
  }

  const YangService =
    require("../../dist/index.js").default || require("../../dist/index.js");
  return new YangService(config.host, config.username, config.password, opts);
}

module.exports = {
  resolveConfig,
  createService,
};
