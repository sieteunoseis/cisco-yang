"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

// YANG GET shortcuts for voice troubleshooting
const YANG_SHORTCUTS = {
  "dial-peers": {
    path: "Cisco-IOS-XE-native:native/dial-peer",
    desc: "Dial-peer configuration",
  },
  sip: {
    path: "Cisco-IOS-XE-native:native/voice",
    desc: "Voice service / SIP configuration",
  },
  interfaces: {
    path: "Cisco-IOS-XE-native:native/interface",
    desc: "Interface configuration (check voice bindings)",
  },
  "sip-ua": {
    path: "Cisco-IOS-XE-native:native/sip-ua",
    desc: "SIP user-agent configuration",
  },
};

module.exports = function registerVoiceCommand(program) {
  const voice = program
    .command("voice")
    .description("Voice troubleshooting shortcuts (YANG GET queries)");

  for (const [name, { path: yangPath, desc }] of Object.entries(
    YANG_SHORTCUTS,
  )) {
    voice
      .command(name)
      .description(desc)
      .action(async (cmdOpts) => {
        const startTime = Date.now();
        const globalOpts = program.opts();
        let status = "success";
        let errorMsg;

        try {
          const service = await createService(globalOpts);
          const opts = { clean: globalOpts.clean || false };
          const result = await service.get(yangPath, opts);
          const format = globalOpts.format;
          await printResult(result, format);
        } catch (err) {
          status = "error";
          errorMsg = err.message;
          printError(err);
        } finally {
          if (globalOpts.audit !== false) {
            const { logAudit } = require("../utils/audit.js");
            const { getActiveDevice } = require("../utils/config.js");
            const deviceName =
              getActiveDevice(globalOpts.device)?.name || "env/flags";
            const entry = {
              device: deviceName,
              operation: `voice ${name}`,
              path: yangPath,
              duration_ms: Date.now() - startTime,
              status,
            };
            if (errorMsg) entry.error = errorMsg;
            logAudit(entry);
          }
        }
      });
  }
};
