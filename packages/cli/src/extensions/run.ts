import * as dotenv from "dotenv";
import { cwd } from "process";

import { decode } from "../env";

module.exports = toolbox => {
  toolbox.buidl3 = {
    getNetworks: async () => {
      const glob = await import("glob");

      const test = /^\/(.+\/)*(.+).config\.(.+)$/g;
      const paths = glob.sync(process.cwd() + "/networks/**.config.js");
      return paths.map(path => [...(path.matchAll(test))][0][2]);
    },
    getModules: async () => {
      const modules = [];

      const glob = await import("glob");

      const paths = glob.sync(cwd() + "/modules/*");
      for (const path of paths) {
        if (/\.\w+$/.test(path)) continue;

        const b3ignore = glob.sync(path + "/.b3ignore")?.[0];
        if (!!b3ignore) continue;

        modules.push(path.split('/').pop().trim());
      }

      return modules;
    },
    getModuleEnv: (module) => {
      const genv = dotenv.parse(cwd() + "/.env");
      const menv = dotenv.parse(cwd() + `/modules/${module}/.env`);

      return {
        __BUIDL3_ENV: process.env.__BUIDL3_ENV,
        __BUIDL3_NETWORK: process.env.__BUIDL3_NETWORK,
        ...decode(process.env.__BUIDL3_ENV),
        ...(genv ?? {}),
        ...(menv ?? {})
      }
    }
  }
}