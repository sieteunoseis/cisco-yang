"use strict";

const { stringify } = require("csv-stringify/sync");

function formatCsv(data) {
  const rows = Array.isArray(data) ? data : [data];
  return stringify(rows, { header: true });
}

module.exports = { formatCsv };
