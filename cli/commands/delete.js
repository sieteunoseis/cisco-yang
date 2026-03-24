"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");
const { enforceReadOnly } = require("../utils/readonly.js");

module.exports = function registerDeleteCommand(program) {
  program
    .command("delete <path>")
    .description("DELETE a YANG resource at the given RESTCONF path")
    .action(async (yangPath, cmdOpts) => {
      const startTime = Date.now();
      const globalOpts = program.opts();
      let status = "success";
      let errorMsg;

      try {
        await enforceReadOnly(globalOpts, "delete");

        const service = await createService(globalOpts);
        const result = await service.delete(yangPath);
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
            operation: "delete",
            path: yangPath,
            duration_ms: Date.now() - startTime,
            status,
          };
          if (errorMsg) entry.error = errorMsg;
          logAudit(entry);
        }
      }
    });
};
