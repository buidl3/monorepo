import { GluegunCommand } from "gluegun";
import { cwd } from "process";

const command: GluegunCommand = {
  name: "pm2:deploy",
  description: "Deploys modules to production",
  run: async (toolbox) => {
    const { print, parameters, system, buidl3 } = toolbox;

    if (process.env.__BUIDL3_MODE === "development") {
      print.error("Cannot deploy in development mode, exiting...");
      process.exit(1);
    }

    const { host, port = 22, user, key = null } = parameters.options;

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

          stream.on('close', () => {
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

            connection.exec('tar -xf dist.tar && rm dist.tar', (err, status) => {
              if (err) throw err;
              print.success("Extracted dist!");

              resolve(true);
            });
          });
        });
      });
    }

    async function start() {
      const modules = await buidl3.getModules();

      print.info('Stopping and deleting old modules...');
      await new Promise(resolve => {
        connection.exec('pm2 stop all', (err, _) => {
          if (err) throw err;
          print.success('Stopped old modules!');

          resolve(true);
        });
      });

      await new Promise(resolve => {
        connection.exec('pm2 delete all', (err, _) => {
          if (err) throw err;
          print.success('Deleted old modules!');

          resolve(true);
        });
      });

      for (const $module of modules) {
        const path = `dist/modules/${$module}`;
        const env = buidl3.getModuleEnv($module);

        await new Promise(resolve => {
          connection.exec(
            `pm2 start ${path} --name ${$module} --time`,
            { env }, (err, _) => {
              if (err) throw err;

              print.success(`Started ${$module} module!`);
              resolve(true);
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