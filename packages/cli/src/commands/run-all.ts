import { GluegunCommand } from "gluegun";
import { cwd } from "process";
import { existsSync } from "fs";

import * as execa from "execa";

const command: GluegunCommand = {
  name: "run:all:dev",
  description: "Run all modules in development mode",
  run: async (toolbox) => {
    const { print, buidl3 } = toolbox;

    const modules = await buidl3.getModules();

    const promises = [];
    for (const $module of modules) {
      const exists = existsSync(cwd() + `/dist/modules/${$module}/index.js`);
      if (!exists) {
        print.error(`Module ${$module} does not exist!`);
        process.exit(1);
      }

      try {
        const env = await buidl3.getModuleEnv($module);
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