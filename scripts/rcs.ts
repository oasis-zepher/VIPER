#!/usr/bin/env bun
import { getMacroDefines } from "./defines.ts";

const defines = getMacroDefines();

const defineArgs = Object.entries(defines).flatMap(([k, v]) => [
  "-d",
  `${k}:${v}`,
]);

const featureArgs = ["--feature", "BRIDGE_MODE", "--feature", "DAEMON"];

const result = Bun.spawnSync(
  ["bun", "run", ...defineArgs, ...featureArgs, "src/entrypoints/cli.tsx", "rcs", ...process.argv.slice(2)],
  { stdio: ["inherit", "inherit", "inherit"] },
);

process.exit(result.exitCode ?? 0);
