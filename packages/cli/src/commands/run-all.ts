import { GluegunCommand } from "gluegun";
import { cwd } from "process";
import { existsSync } from "fs";

import * as dotenv from "dotenv";
import * as glob from "glob";
import * as execa from "execa";

const command: GluegunCommand = {
  name: "run:all:dev",
  description: "Run all modules in development mode",
  run: async (toolbox) => {
    const { print } = toolbox;

    const modules: Array<string> = [];

    const paths = glob.sync(cwd() + "/modules/*");
    for (const path of paths) {
      if (path.endsWith("tsconfig.json")) continue;

      const b3ignore = glob.sync(path + "/.b3ignore")?.[0];
      if (!!b3ignore) continue;

      modules.push(path.split('/').pop().trim());
    }

    const genv = dotenv.config({ path: cwd() + "/.env" });

    const promises = [];

    for (const $module of modules) {
      const menv = dotenv.config({ path: cwd() + $module });
      const env = {
        __BUIDL3_NETWORK: process.env.__BUIDL3_NETWORK,
        ...(genv?.parsed ?? {}),
        ...(menv?.parsed ?? {})
      }

      const exists = existsSync(cwd() + `/dist/modules/${$module}/index.js`);
      if (!exists) {
        print.error(`Module ${$module} does not exist!`);
        process.exit(1);
      }

      try {
        const subprocess = execa("node", [`dist/modules/${$module}`], { env });
        subprocess.stdout.pipe(process.stdout);
        subprocess.stderr.pipe(process.stderr);

        print.info($module + " has started!");
        promises.push(subprocess);
      } catch (error) {
        print.error(error);
      }
    }

    await Promise.allSettled(promises);
  }
}

module.exports = command;