#!/usr/bin/env node
// Public installer entry. All logic lives in @technomanceer/motion-cli (single shared bootstrap).
import { main } from "@technomanceer/motion-cli/main";

process.exitCode = await main(process.argv.slice(2), { bin: "motion-studio" });
