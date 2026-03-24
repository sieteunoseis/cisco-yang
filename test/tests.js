"use strict";

const { execFileSync } = require("node:child_process");
const path = require("node:path");
const assert = require("node:assert");

const BIN = path.join(__dirname, "..", "bin", "cisco-yang.js");

function run(args) {
  return execFileSync("node", [BIN, ...args], {
    encoding: "utf-8",
    timeout: 10000,
    env: {
      ...process.env,
      CISCO_YANG_CONFIG_DIR: "/tmp/cisco-yang-test-" + process.pid,
    },
  });
}

console.log("Test: --help lists all commands");
const help = run(["--help"]);
assert(help.includes("get"), "should list get command");
assert(help.includes("set"), "should list set command");
assert(help.includes("delete"), "should list delete command");
assert(help.includes("rpc"), "should list rpc command");
assert(help.includes("models"), "should list models command");
assert(help.includes("operations"), "should list operations command");
assert(help.includes("describe"), "should list describe command");
assert(help.includes("voice"), "should list voice command");
assert(help.includes("doctor"), "should list doctor command");
assert(help.includes("config"), "should list config command");
console.log("  PASS");

console.log("Test: --version shows version");
const version = run(["--version"]);
assert(version.trim() === "1.0.0", `expected 1.0.0, got ${version.trim()}`);
console.log("  PASS");

console.log("Test: config list with empty config");
const listOutput = run(["config", "list"]);
assert(listOutput.includes("No results found"), "should show no results");
console.log("  PASS");

console.log("Test: voice --help lists subcommands");
const voiceHelp = run(["voice", "--help"]);
assert(voiceHelp.includes("dial-peers"), "should list dial-peers");
assert(voiceHelp.includes("sip"), "should list sip");
assert(voiceHelp.includes("interfaces"), "should list interfaces");
assert(voiceHelp.includes("sip-ua"), "should list sip-ua");
console.log("  PASS");

console.log("Test: SDK loads and exports YangService");
const YangService = require("../index.js");
assert(typeof YangService === "function", "should export constructor");
console.log("  PASS");

console.log("\nAll tests passed.");
