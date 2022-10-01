import * as dotenv from "dotenv";
import { cwd } from "process";

export function encode(data) {
  return Buffer.from(data || "", "utf8").toString("base64");
}

export function decode(data) {
  return JSON.parse(Buffer.from(data || "", "base64").toString("utf8") || "{}");
}

export function injectGlobal() {
  const env = dotenv.config({ path: cwd() + "/.env" });
  process.env = { ...process.env, ...(env?.parsed ?? {}) };
}

export function injectNetwork() {
  const env = dotenv.config({ path: cwd() + "/networks/.env" });
  const encoded = encode(JSON.stringify(env?.parsed ?? {}));
  process.env.__BUIDL3_NETWORK = encoded;

  return encoded;
}