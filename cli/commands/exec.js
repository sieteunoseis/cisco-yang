"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");

// RPCs that are read-only and don't need write confirmation
const READ_ONLY_RPCS = new Set([
  "Cisco-IOS-XE-rpc:test",
  "Cisco-IOS-XE-rpc:monitor",
  "cisco-ia:is-syncing",
  "cisco-ia:checkpoint",
]);

module.exports = function registerRpcCommand(program) {
  program
    .command("rpc <operation>")
    .description(
      "Invoke a RESTCONF RPC operation (use 'operations' to list available)",
    )
    .option("--input <json>", "JSON input payload")
    .action(async (operation, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        if (!READ_ONLY_RPCS.has(operation)) {
          await enforceReadOnly(globalOpts, "rpc");
        }

        let input;
        if (cmdOpts.input) {
          input = JSON.parse(cmdOpts.input);
        }

        const service = await createService(globalOpts);
        const result = await service.rpc(operation, input);
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
            operation: "rpc",
            rpcName: operation,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
