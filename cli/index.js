"use strict";

const { Command } = require("commander");
const pkg = require("../package.json");

const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (
    typeof warning === "string" &&
    warning.includes("NODE_TLS_REJECT_UNAUTHORIZED")
  )
    return;
  originalEmitWarning.call(process, warning, ...args);
};

try {
  const updateNotifier =
    require("update-notifier").default || require("update-notifier");
  updateNotifier({ pkg }).notify();
} catch {}

const program = new Command();

program
  .name("cisco-yang")
  .description("CLI for IOS-XE devices via RESTCONF")
  .version(pkg.version)
  .option("--format <type>", "output format: table, json, toon, csv", "table")
  .option("--host <host>", "device hostname (overrides config/env)")
  .option("--username <user>", "device username (overrides config/env)")
  .option("--password <pass>", "device password (overrides config/env)")
  .option("--device <name>", "use a specific named device from config")
  .option("--clean", "remove empty/null values from results")
  .option("--insecure", "skip TLS certificate verification")
  .option("--no-audit", "disable audit logging for this command")
  .option("--read-only", "restrict to read-only operations")
  .option("--debug", "enable debug logging");

// Register commands
require("./commands/config.js")(program);
require("./commands/get.js")(program);
require("./commands/set.js")(program);
require("./commands/delete.js")(program);
require("./commands/exec.js")(program); // registers 'rpc' command
require("./commands/models.js")(program);
require("./commands/operations.js")(program);
require("./commands/describe.js")(program);
require("./commands/voice.js")(program);
require("./commands/doctor.js")(program);

program.parse();
