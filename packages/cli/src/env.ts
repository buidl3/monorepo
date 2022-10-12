import * as dotenv from "dotenv";
import { cwd } from "process";
import { readFileSync } from "fs";

export function encode(data) {
  return Buffer.from(data || "", "utf8").toString("base64");
}

export function decode(data) {
  return JSON.parse(Buffer.from(data || "", "base64").toString("utf8") || "{}");
}

export function injectGlobal() {
  const env = dotenv.config({ path: cwd() + "/.env" });

  const encoded = encode(JSON.stringify(env?.parsed ?? {}));
  process.env.__BUIDL3_ENV = encoded;
}

export function injectNetwork() {
  const content = readFileSync(cwd() + "/networks/.env");
  const env = dotenv.parse(content);

  const encoded = encode(JSON.stringify(env ?? {}));
  process.env.__BUIDL3_NETWORK = encoded;
}