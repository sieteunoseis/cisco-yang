"use strict";

const { stringify } = require("csv-stringify/sync");

function formatCsv(data) {
  if (data === null || data === undefined) {
    return "";
  }
  const rows = Array.isArray(data) ? data : [data];
  return stringify(rows, { header: true });
}

module.exports = { formatCsv };
