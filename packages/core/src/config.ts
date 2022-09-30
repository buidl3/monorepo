import * as glob from "glob";
import * as Path from "path";

function decode(data = "") {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8") || "{}");
}

const test = /^\/(.+\/)*(.+).config\.(.+)$/g;
export function getNetworks(): Array<string> {
  const paths = glob.sync(process.cwd() + "/networks/**.config.js");
  return paths.map(path => [...(path.matchAll(test))][0][2]);
}

export function getNetworkEnv(): Object {
  if (typeof process.env.__BUIDL3_NETWORK === "undefined")
    throw "__BUIDL3_NETWORK was not set";

  return decode(process.env.__BUIDL3_NETWORK);
}

export * from "./web3/Network";
