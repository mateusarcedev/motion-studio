#!/usr/bin/env node
import { main } from "../lib/main.mjs";

process.exitCode = await main(process.argv.slice(2), { bin: "motion" });
