#!/usr/bin/env node
/**
 * Score one or more vehicles using the Tesla Rubric.
 * Usage:
 *   bun run scripts/score.js                    # read vehicles JSON array from stdin
 *   bun run scripts/score.js vehicles.json     # read from file
 *   echo '{"selections":{"price":45000}}' | bun run scripts/score.js
 *
 * Input: JSON array of { selections: { criterionId: value, ... }, id?: string } or single object.
 * Output: JSON array of { id?, total, label, color, details? } (or single object if input was single).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rubricPath = resolve(__dirname, "../public/rubric.json");

function loadRubric() {
  const raw = readFileSync(rubricPath, "utf8");
  const rubric = JSON.parse(raw);
  // Normalize threshold.max null -> Infinity for comparison
  rubric.criteria.forEach((c) => {
    if (c.type === "range_score" && c.thresholds) {
      c.thresholds = c.thresholds.map((t) => ({
        ...t,
        max: t.max == null ? Infinity : t.max,
      }));
    }
  });
  return rubric;
}

function scoreVehicle(rubric, selections) {
  let total = 0;
  const details = [];
  for (const c of rubric.criteria) {
    const val = selections[c.id];
    if (c.type === "select") {
      const opt = c.options?.find((o) => o.value === val || o.value === String(val));
      if (opt) {
        total += opt.points;
        details.push({ name: c.name, points: opt.points, label: opt.label });
      }
    } else if (c.type === "boolean") {
      if (val === true) {
        total += c.basePoints;
        details.push({ name: c.name, points: c.basePoints, label: "Yes" });
      }
    } else if (c.type === "conditional_boolean") {
      if (val === true) {
        let pts = c.basePoints;
        if (c.conditionalPoints && selections[c.conditionalPoints.when] === c.conditionalPoints.equals) {
          pts += c.conditionalPoints.bonus;
        }
        total += pts;
        details.push({ name: c.name, points: pts, label: "Yes" });
      }
    } else if (c.type === "price") {
      const price = parseFloat(val);
      if (!Number.isNaN(price)) {
        const pts = -((price - c.basePrice) / 1000) * Math.abs(c.pointsPerThousand);
        total += pts;
        details.push({ name: c.name, points: pts, label: `$${price.toLocaleString()}` });
      }
    } else if (c.type === "range_score") {
      const num = parseFloat(val);
      if (!Number.isNaN(num)) {
        const t = c.thresholds.find((th) => num <= th.max);
        if (t) {
          total += t.points;
          details.push({ name: c.name, points: t.points, label: `${num.toLocaleString()} mi` });
        }
      }
    }
  }
  total = Math.round(total * 10) / 10;
  const bands = [...rubric.scoreBands].sort((a, b) => (b.minScore ?? -Infinity) - (a.minScore ?? -Infinity));
  const band = bands.find((b) => b.minScore == null || total >= b.minScore);
  return { total, label: band?.label ?? "Avoid", color: band?.color ?? "#ef4444", details };
}

async function main() {
  const rubric = loadRubric();
  let input;
  const fileArg = process.argv[2];
  if (fileArg) {
    input = JSON.parse(readFileSync(fileArg, "utf8"));
  } else {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const str = Buffer.concat(chunks).toString("utf8").trim();
    if (!str) {
      console.error("Usage: bun run scripts/score.js [vehicles.json]");
      process.exit(1);
    }
    input = JSON.parse(str);
  }
  const isArray = Array.isArray(input);
  const vehicles = isArray ? input : [input];
  const results = vehicles.map((v) => {
    const { total, label, color, details } = scoreVehicle(rubric, v.selections || v);
    const out = { id: v.id ?? v.vin ?? null, total, label, color };
    if (process.argv.includes("--details")) out.details = details;
    return out;
  });
  console.log(JSON.stringify(isArray ? results : results[0], null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
