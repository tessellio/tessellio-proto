#!/usr/bin/env node
// Regenerates the TypeScript bindings for the Tessellio codec's wire
// schema.
//
// Usage:
//   node tools/generate.mjs          # write the generated module
//   node tools/generate.mjs --check  # fail when the checked-in module is stale
//
// The toolchain is pinned through the package's devDependencies (`ts-proto`
// for the plugin, `grpc-tools` for protoc and the well-known type protos), so
// a checkout regenerates byte-identical output.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const protoDir = path.join(root, "proto", "tessellio", "v1");
const outputDir = path.join(root, "src", "generated");
const protoFile = "tessellio.proto";
const checkOnly = process.argv.includes("--check");

function fail(message) {
  console.error(`mlp-proto: ${message}`);
  process.exit(1);
}

function resolveTool(relativePath, label) {
  const resolved = path.join(root, relativePath);
  if (!fs.existsSync(resolved)) {
    fail(
      `${label} is missing at ${relativePath}; run \`npm install\` in this repository`,
    );
  }
  return resolved;
}

const protoc = resolveTool(
  path.join(
    "node_modules",
    "grpc-tools",
    "bin",
    process.platform === "win32" ? "protoc.exe" : "protoc",
  ),
  "protoc",
);
const wellKnownIncludes = path.join(root, "node_modules", "grpc-tools", "bin");
const plugin = resolveTool(
  path.join("node_modules", ".bin", "protoc-gen-ts_proto"),
  "protoc-gen-ts_proto",
);

function generate(outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const result = spawnSync(
    protoc,
    [
      `--plugin=protoc-gen-ts_proto=${plugin}`,
      `--ts_proto_out=${outDir}`,
      `-I${protoDir}`,
      `-I${wellKnownIncludes}`,
      protoFile,
    ],
    { cwd: protoDir, stdio: "inherit" },
  );
  if (result.error) {
    fail(`failed to run protoc: ${result.error.message}`);
  }
  if (result.status !== 0) {
    fail(`protoc exited with status ${result.status}`);
  }
}

function listFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(full, base));
    } else {
      files.push(path.relative(base, full));
    }
  }
  return files.sort();
}

if (checkOnly) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "mlp-proto-"));
  try {
    generate(scratch);
    const expected = listFiles(scratch);
    const actual = fs.existsSync(outputDir) ? listFiles(outputDir) : [];
    const drift = [];
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      drift.push(
        `file set differs: generated [${expected.join(", ")}] vs checked in [${actual.join(", ")}]`,
      );
    }
    for (const file of expected) {
      const checkedIn = path.join(outputDir, file);
      if (!fs.existsSync(checkedIn)) {
        continue;
      }
      const generatedBytes = fs.readFileSync(path.join(scratch, file));
      if (!generatedBytes.equals(fs.readFileSync(checkedIn))) {
        drift.push(file);
      }
    }
    if (drift.length > 0) {
      fail(
        `generated TypeScript is stale:\n  ${drift.join(
          "\n  ",
        )}\nrun \`npm run generate\` and commit the result`,
      );
    }
    console.log(
      `tessellio-proto: generated TypeScript is current (${expected.length} file(s))`,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
} else {
  generate(outputDir);
  console.log(
    `tessellio-proto: regenerated ${listFiles(outputDir).join(", ")}`,
  );
}
