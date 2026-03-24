"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const AUDIT_FILE = "audit.jsonl";
const ROTATION_THRESHOLD = 10 * 1024 * 1024;

const REDACTED_FIELDS = new Set([
  "password",
  "username",
  "user",
  "pass",
  "secret",
  "token",
  "auth",
]);

function getConfigDir() {
  return (
    process.env.CISCO_YANG_CONFIG_DIR || path.join(os.homedir(), ".cisco-yang")
  );
}

function sanitize(entry) {
  if (!entry || typeof entry !== "object") return {};
  const safe = {};
  for (const [key, val] of Object.entries(entry)) {
    if (!REDACTED_FIELDS.has(key.toLowerCase())) {
      safe[key] = val;
    }
  }
  return safe;
}

async function logAudit(entry) {
  try {
    const safe = sanitize(entry);
    const record = { timestamp: new Date().toISOString(), ...safe };
    const line = JSON.stringify(record) + "\n";
    const dir = getConfigDir();
    fs.mkdirSync(dir, { recursive: true });
    const filePath = path.join(dir, AUDIT_FILE);
    fs.appendFileSync(filePath, line, "utf8");
  } catch {
    // Fire-and-forget
  }
}

async function rotateAuditLog() {
  try {
    const dir = getConfigDir();
    const filePath = path.join(dir, AUDIT_FILE);
    if (!fs.existsSync(filePath)) return;
    const stat = fs.statSync(filePath);
    if (stat.size <= ROTATION_THRESHOLD) return;
    const rotatedPath = path.join(dir, AUDIT_FILE + ".1");
    if (fs.existsSync(rotatedPath)) {
      fs.unlinkSync(rotatedPath);
    }
    fs.renameSync(filePath, rotatedPath);
    fs.writeFileSync(filePath, "", "utf8");
  } catch {
    // Fire-and-forget
  }
}

module.exports = { logAudit, rotateAuditLog };
