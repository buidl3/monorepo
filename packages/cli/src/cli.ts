import { build } from 'gluegun'
import { cwd } from 'process';

import { injectGlobal, injectNetwork } from "./env";

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

  const dev = argv[2] !== "--prod";

  injectGlobal(dev);
  injectNetwork(dev);

  process.env.__BUIDL3_MODE = dev ? "development" : "production";

  // Remove mode flag
  if (argv[2] === '--prod' || argv[2] === '--dev')
    argv.splice(2, 1)

  const toolbox = await cli.run(argv);
  return toolbox;
}

module.exports = { run }
