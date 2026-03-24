"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");
const { readStdin } = require("../utils/stdin.js");

module.exports = function registerSetCommand(program) {
  program
    .command("set <path>")
    .description("PATCH (or PUT with --method put) data at a YANG path")
    .option("--data <json>", "JSON payload (inline)")
    .option("--stdin", "read JSON payload from stdin")
    .option("--method <method>", "HTTP method: patch or put", "patch")
    .action(async (yangPath, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "set");

        let jsonData = cmdOpts.data;
        if (cmdOpts.stdin) {
          const stdinData = await readStdin();
          if (stdinData) jsonData = stdinData.trim();
        }

        if (!jsonData) {
          throw new Error("No data provided. Use --data '{...}' or --stdin");
        }

        const data = JSON.parse(jsonData);
        const service = await createService(globalOpts);
        const result = await service.set(yangPath, data, cmdOpts.method);
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
            operation: "set",
            path: yangPath,
            method: cmdOpts.method,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
