"use strict";

const { getConfigPath, getConfigDir } = require("../utils/config.js");
const { resolveConfig, deviceLabel } = require("../utils/connection.js");

module.exports = function registerDoctorCommand(program) {
  program
    .command("doctor")
    .description("Check RESTCONF connectivity and configuration health")
    .action(async (opts, command) => {
      const globalOpts = command.optsWithGlobals();
      let passed = 0;
      let warned = 0;
      let failed = 0;

      const ok = (msg) => {
        console.log(`  ✓ ${msg}`);
        passed++;
      };
      const warn = (msg) => {
        console.log(`  ⚠ ${msg}`);
        warned++;
      };
      const fail = (msg) => {
        console.log(`  ✗ ${msg}`);
        failed++;
      };

      console.log("\n  cisco-yang doctor");
      console.log("  " + "─".repeat(50));

      console.log("\n  Configuration");
      let conn;
      try {
        // Resolve exactly the way the actual connection will (respecting
        // --device / --host / env vars), so this can never show a
        // different device than the one doctor is about to test.
        conn = await resolveConfig(globalOpts);
        ok(`Active device: ${deviceLabel(globalOpts)}`);
        ok(`Host: ${conn.host}`);
        ok(`Username: ${conn.username}`);

        if (conn.insecure) warn("TLS verification: disabled (--insecure)");
        else ok("TLS verification: enabled");
      } catch (err) {
        fail(`Config error: ${err.message}`);
        printSummary(passed, warned, failed);
        return;
      }

      console.log("\n  RESTCONF API");
      try {
        if (conn.insecure) {
          process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
        }
        const YangService =
          require("../../dist/index.js").default ||
          require("../../dist/index.js");
        const service = new YangService(
          conn.host,
          conn.username,
          conn.password,
          { insecure: conn.insecure },
        );

        await service.testConnection();
        ok("RESTCONF API: connected");

        try {
          const models = await service.getModels();
          ok(`YANG models: ${models.length} available`);

          const voiceModels = models.filter((m) =>
            m.name.toLowerCase().includes("voice"),
          );
          if (voiceModels.length > 0) {
            ok(`Voice models: ${voiceModels.length} found`);
          } else {
            warn("Voice models: none found — device may not support voice");
          }
        } catch {
          warn("Could not list YANG models");
        }

        try {
          const operations = await service.getOperations();
          const execOp = Object.keys(operations || {}).find((name) =>
            name.endsWith(":exec"),
          );
          if (execOp) {
            ok(`Exec RPC: available (${execOp})`);
          } else {
            warn("Exec RPC: not exposed by this device's YANG capabilities");
          }
        } catch {
          warn("Could not check for an exec RPC");
        }
      } catch (err) {
        const msg = err.message || String(err);
        if (
          msg.includes("401") ||
          msg.includes("Authentication") ||
          msg.includes("Unauthorized")
        ) {
          fail("RESTCONF API: authentication failed — check username/password");
        } else if (msg.includes("ECONNREFUSED")) {
          fail(
            "RESTCONF API: connection refused — check host and verify RESTCONF is enabled",
          );
        } else if (msg.includes("ENOTFOUND")) {
          fail("RESTCONF API: hostname not found — check host");
        } else if (msg.includes("certificate")) {
          fail(
            "RESTCONF API: TLS certificate error — try adding --insecure to the device config",
          );
        } else {
          fail(`RESTCONF API: ${msg}`);
        }
      }

      console.log("\n  Security");
      try {
        const fs = require("node:fs");
        const configPath = getConfigPath();
        const stats = fs.statSync(configPath);
        const mode = (stats.mode & 0o777).toString(8);
        if (mode === "600") ok(`Config file permissions: ${mode} (secure)`);
        else
          warn(
            `Config file permissions: ${mode} — should be 600. Run: chmod 600 ${configPath}`,
          );
      } catch {
        /* config file may not exist yet */
      }

      try {
        const fs = require("node:fs");
        const path = require("node:path");
        const auditPath = path.join(getConfigDir(), "audit.jsonl");
        if (fs.existsSync(auditPath)) {
          const stats = fs.statSync(auditPath);
          const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
          ok(`Audit trail: ${sizeMB}MB`);
          if (stats.size > 8 * 1024 * 1024)
            warn("Audit trail approaching 10MB rotation limit");
        } else {
          ok("Audit trail: empty (no operations logged yet)");
        }
      } catch {
        /* ignore */
      }

      printSummary(passed, warned, failed);
    });

  function printSummary(passed, warned, failed) {
    console.log("\n  " + "─".repeat(50));
    console.log(
      `  Results: ${passed} passed, ${warned} warning${warned !== 1 ? "s" : ""}, ${failed} failed`,
    );
    if (failed > 0) {
      process.exitCode = 1;
      console.log("  Status:  issues found — review failures above");
    } else if (warned > 0) {
      console.log("  Status:  healthy with warnings");
    } else {
      console.log("  Status:  all systems healthy");
    }
    console.log("");
  }
};
