import { GluegunCommand } from "gluegun";
import { cwd } from "process";

const command: GluegunCommand = {
  name: "pm2:deploy",
  description: "Deploys modules to production: --host --port (default: 22) --user --key (defaults: ~/.ssh/id_rsa)",
  run: async (toolbox) => {
    const { print, parameters, system, buidl3 } = toolbox;

    const cron = await import("cron-validate").then(m => m.default);

    if (process.env.__BUIDL3_MODE === "development") {
      print.error("Cannot deploy in development mode, exiting...");
      process.exit(1);
    }

    const { host, port = 22, user, key = "~/.ssh/id_rsa" } = parameters.options;

    if (!host || !user || !key) {
      print.error("Please provide --host, --user and --key");
      process.exit(1);
    }

    const { Client } = await import("ssh2");
    const { readFileSync } = await import('fs');
    const { c } = await import('tar');

    print.info(`Deploying to ${host}@${port}...`);

    const connection = new Client();

    async function build() {
      print.info("Building...");
      await system.exec("npm run build");
    }

    async function upload() {
      print.info("Uploading dependencies...");

      await new Promise(resolve => {
        connection.sftp(async (err, sftp) => {
          if (err) throw err;

          const pkg = readFileSync(cwd() + "/package.json");
          const stream = sftp.createWriteStream('/app/package.json');
          stream.write(pkg, (err) => {
            if (err) throw err;
            resolve(true);
          });
        });
      });

      // package-lock.json
      await new Promise(resolve => {
        connection.sftp(async (err, sftp) => {
          if (err) throw err;

          const lock = readFileSync(cwd() + "/package-lock.json");
          const stream = sftp.createWriteStream('/app/package-lock.json');
          stream.write(lock, (err) => {
            if (err) throw err;
            resolve(true);
          });
        });
      });

      // Installing dependencies
      print.info('Installing dependencies...');
      await new Promise(resolve => {
        connection.exec('npm install --omit=dev', (err, stream) => {
          if (err) throw err;
          stream.pipe(process.stdout);

          stream.on('exit', () => {
            print.success("Installed dependencies!");
            resolve(true);
          });
        });
      });

      print.info("Uploading dist...");
      await new Promise(resolve => {
        connection.sftp((err, sftp) => {
          const stream = sftp.createWriteStream('/app/dist.tar');

          c({ gzip: false }, ["dist"]).pipe(stream);
          stream.on('close', () => {
            print.success("Uploaded dist successfully!");

            connection.exec('tar -xf dist.tar && rm dist.tar', (err, stream) => {
              if (err) throw err;

              stream.on('exit', () => {
                print.success("Extracted dist!");
                resolve(true);
              });
            });
          });
        });
      });
    }

    async function start() {
      const modules = await buidl3.getModules();

      print.info('Stopping and deleting old modules...');
      await new Promise(resolve => {
        connection.exec('pm2 stop all', (err, stream) => {
          if (err) throw err;

          stream.on('exit', () => {
            print.success('Stopped old modules!');
            resolve(true);
          })
        });
      });

      await new Promise(resolve => {
        connection.exec('pm2 delete all', (err, stream) => {
          if (err) throw err;

          stream.on('exit', () => {
            print.success('Deleted old modules!');
            resolve(true);
          });
        });
      });

      for (const $module of modules) {
        const path = `dist/modules/${$module}`;
        const env = buidl3.getModuleEnv($module);

        let config: any = {
          "restart": false,
          "cron": null
        }

        try {
          config = {
            ...config,
            ...JSON.parse(readFileSync(cwd() + `/modules/${$module}/pm2.json`, 'utf-8'))
          }
        } catch (error) {
          console.log('no pm2.json found');
        }

        if (config.cron && !cron(config.cron).isValid()) {
          print.warning(`${$module}: Incorrect cron format, skipping...`);
          continue;
        }

        const args = [
          "pm2",
          "start", path,
          "--name", $module,
          "--time",
          config.restart === false ? "--no-autorestart" : '',
          config.cron ? `--cron-restart="${config?.cron}"` : '',
          config.cron ? " && pm2 stop " + $module : ''
        ];

        await new Promise(resolve => {
          connection.exec(args.join(' '),
            { env }, (err, stream) => {
              if (err) throw err;

              stream.on('exit', () => {
                if (config.cron)
                  print.success(`Deployed ${$module} module!`);
                else
                  print.success(`Started ${$module} module!`);
                resolve(true);
              })

            });
        });
      }
    }

    connection.on('ready', async () => {
      await build();
      await upload();
      await start();

      connection.end();
    }).connect({
      host,
      port,
      username: user,
      privateKey: readFileSync(key)
    });

  }
}

module.exports = command;