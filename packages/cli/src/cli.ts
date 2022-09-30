import { build } from 'gluegun'
import { cwd } from 'process';

import * as dotenv from 'dotenv';
dotenv.config();

async function run(argv) {

  const cli = build()
    .brand('buidl3')
    .src(__dirname)
    .plugins(cwd(), { matching: "cli" })
    .help() // provides default for help, h, --help, -h
    .version() // provides default for version, v, --version, -v
    .create();

  const toolbox = await cli.run(argv);
  return toolbox;
}

module.exports = { run }
