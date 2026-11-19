import { readFileSync } from "node:fs";

export const PKG = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
export const VERSION = PKG.version;
