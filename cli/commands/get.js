"use strict";

const { createService } = require("../utils/connection.js");
const { printResult, printError } = require("../utils/output.js");

module.exports = function registerGetCommand(program) {
  program
    .command("get <path>")
    .description("GET a YANG resource at the given RESTCONF path")
    .action(async (yangPath, cmdOpts) => {
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
            operation: "get",
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
