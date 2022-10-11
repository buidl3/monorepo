import { GluegunCommand } from "gluegun";
import { cwd } from "process";
import { existsSync } from "fs";

import * as dotenv from "dotenv";
import * as execa from "execa";

const command: GluegunCommand = {
  name: "run:dev",
  description: "Run module in development mode",
  run: async (toolbox) => {
    const { print, parameters } = toolbox;

    const [$module = ''] = parameters.array || [];
    if (!$module) {
      print.error("Module was not provided!");
      process.exit(1);
    }

    const genv = dotenv.config({ path: cwd() + "/.env" });
    const menv = dotenv.config({ path: cwd() + `/modules/${$module}/.env` });

    const env = {
      __BUIDL3_NETWORK: process.env.__BUIDL3_NETWORK,
      ...(genv?.parsed ?? {}),
      ...(menv?.parsed ?? {})
    }

    const exists = existsSync(cwd() + `/dist/modules/${$module}/index.js`);
    if (!exists) {
      print.error("Module does not exist!");
      process.exit(1);
    }

    try {
      const subprocess = execa("nodemon", [`dist/modules/${$module}`], { env });
      subprocess.stdout.pipe(process.stdout);
      subprocess.stderr.pipe(process.stderr);

      await subprocess;
      process.exit(0);
    } catch (error) {
      print.error(error);
      process.exit(1);
    }
  }
}

module.exports = command;