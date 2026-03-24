"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");

const SS_PLACEHOLDER_RE = /<ss:\d+:[^>]+>/;

function getConfigDir() {
  return (
    process.env.CISCO_YANG_CONFIG_DIR ||
    path.join(require("node:os").homedir(), ".cisco-yang")
  );
}

function getConfigPath() {
  return path.join(getConfigDir(), "config.json");
}

function loadConfig() {
  const cfgPath = getConfigPath();
  if (!fs.existsSync(cfgPath)) {
    return { activeDevice: null, devices: {} };
  }
  try {
    const raw = fs.readFileSync(cfgPath, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to load config from ${cfgPath}: ${err.message}`);
  }
}

function saveConfig(config) {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cfgPath = getConfigPath();
  const json = JSON.stringify(config, null, 2);
  fs.writeFileSync(cfgPath, json, { mode: 0o600, encoding: "utf8" });
}

function addDevice(name, opts) {
  const { host, username, password, insecure } = opts;
  const config = loadConfig();
  const entry = { host, username, password };
  if (insecure !== undefined) {
    entry.insecure = insecure;
  }
  config.devices[name] = entry;
  if (
    config.activeDevice === null ||
    Object.keys(config.devices).length === 1
  ) {
    config.activeDevice = name;
  }
  saveConfig(config);
  return config;
}

function useDevice(name) {
  const config = loadConfig();
  if (!config.devices[name]) {
    throw new Error(`Device "${name}" not found`);
  }
  config.activeDevice = name;
  saveConfig(config);
  return config;
}

function removeDevice(name) {
  const config = loadConfig();
  if (!config.devices[name]) {
    throw new Error(`Device "${name}" not found`);
  }
  const wasActive = config.activeDevice === name;
  delete config.devices[name];
  if (wasActive) {
    const remaining = Object.keys(config.devices);
    config.activeDevice = remaining.length > 0 ? remaining[0] : null;
  }
  saveConfig(config);
  return config;
}

function getActiveDevice(deviceName) {
  const config = loadConfig();
  if (deviceName) {
    const device = config.devices[deviceName];
    if (!device) return null;
    return { name: deviceName, ...device };
  }
  const activeName = config.activeDevice;
  if (!activeName || !config.devices[activeName]) {
    return null;
  }
  return { name: activeName, ...config.devices[activeName] };
}

function listDevices() {
  return loadConfig();
}

function maskPassword(password) {
  if (!password) return password;
  if (SS_PLACEHOLDER_RE.test(password)) return password;
  return "*".repeat(password.length);
}

function hasSsPlaceholders(obj) {
  for (const value of Object.values(obj)) {
    if (typeof value === "string" && SS_PLACEHOLDER_RE.test(value)) {
      return true;
    }
    if (value !== null && typeof value === "object") {
      if (hasSsPlaceholders(value)) return true;
    }
  }
  return false;
}

async function resolveSsPlaceholders(obj) {
  if (!hasSsPlaceholders(obj)) {
    return obj;
  }
  const resolved = { ...obj };
  for (const [key, value] of Object.entries(resolved)) {
    if (typeof value === "string") {
      const match = value.match(/<ss:(\d+):([^>]+)>/);
      if (match) {
        const [, id, field] = match;
        resolved[key] = await resolveSsValue(id, field);
      }
    } else if (value !== null && typeof value === "object") {
      resolved[key] = await resolveSsPlaceholders(value);
    }
  }
  return resolved;
}

function resolveSsValue(id, field) {
  return new Promise((resolve, reject) => {
    execFile(
      "ss-cli",
      ["get", id, "--format", "json"],
      (err, stdout, stderr) => {
        if (err) {
          if (err.code === "ENOENT" || (stderr && /not found/i.test(stderr))) {
            return reject(
              new Error(
                "ss-cli is not installed or not in PATH. " +
                  "Please install ss-cli to resolve Secret Server placeholders. " +
                  `Original error: ${err.message}`,
              ),
            );
          }
          return reject(
            new Error(`ss-cli failed for secret ${id}: ${err.message}`),
          );
        }
        try {
          const data = JSON.parse(stdout);
          const fieldLower = field.toLowerCase();
          const foundKey = Object.keys(data).find(
            (k) => k.toLowerCase() === fieldLower,
          );
          if (foundKey !== undefined) {
            return resolve(data[foundKey]);
          }
          if (Array.isArray(data.items)) {
            const item = data.items.find(
              (i) =>
                (i.slug && i.slug.toLowerCase() === fieldLower) ||
                (i.fieldName && i.fieldName.toLowerCase() === fieldLower),
            );
            if (item) {
              return resolve(item.itemValue);
            }
          }
          return reject(
            new Error(`Field "${field}" not found in secret ${id}`),
          );
        } catch (parseErr) {
          reject(
            new Error(
              `Failed to parse ss-cli output for secret ${id}: ${parseErr.message}`,
            ),
          );
        }
      },
    );
  });
}

module.exports = {
  loadConfig,
  saveConfig,
  addDevice,
  useDevice,
  removeDevice,
  getActiveDevice,
  listDevices,
  maskPassword,
  getConfigDir,
  getConfigPath,
  hasSsPlaceholders,
  resolveSsPlaceholders,
};
