import { build } from 'gluegun'
import { cwd } from 'process';

import { injectGlobal, injectNetwork } from "./env";

injectGlobal();
injectNetwork();

async function run(argv) {
  const cli = build()
    .brand('buidl3')
    .src(__dirname)
    .plugins(cwd(), { matching: "cli" })
    .plugins(cwd() + "/node_modules/@buidl3", { matching: "cli-*" })
    .help()
    .version()
    .defaultCommand()
    .create();

  const toolbox = await cli.run(argv);
  return toolbox;
}

module.exports = { run }
