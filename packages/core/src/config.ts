function decode(data = "") {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8") || "{}");
}

export function getEnv(): any {
  if (typeof process.env.__BUIDL3_ENV === "undefined")
    throw "__BUIDL3_ENV variable needs to be present to run, exiting...";

  return decode(process.env.__BUIDL3_ENV);
}

export function getNetworkEnv(): any {
  if (typeof process.env.__BUIDL3_NETWORK === "undefined")
    throw "__BUIDL3_NETWORK variable needs to be present to run, exiting...";

  return decode(process.env.__BUIDL3_NETWORK);
}

export function getModuleEnv(): any {
  if (typeof process.env.__BUIDL3_MODULE === "undefined")
    throw "__BUIDL3_MODULE variable needs to be present to run, exiting...";

  return decode(process.env.__BUIDL3_MODULE);
}

