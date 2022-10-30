import * as Config from "../config";
const env = Config.getEnv();

import type { ClientConfiguration, DatabasePool } from "slonik";
import { createPool } from "slonik";

import createSubscriber, { Subscriber } from "pg-listen";

import type { Buidl3QueryMethods } from "./Query";
import * as QueryMethods from "./Query";

interface ConnectionOptions {
  url?: string;
  connectionName?: string;

  client?: ClientConfiguration
}

export type Buidl3Subscriber = Subscriber<{ [channel: string]: any }>;
export type Buidl3Database = DatabasePool &
  Buidl3QueryMethods & { realtime: Buidl3Subscriber };

export async function create(options?: ConnectionOptions): Promise<Buidl3Database> {
  let { url, connectionName = null, client = {} } = options ?? {};
  if (!url) url = env?.['DB_CONNECT'] as string;
  if (!url) throw "No DB_CONNECT variable was set!";

  if (!connectionName) {
    try {
      const menv = Config.getModuleEnv();
      connectionName = menv?.["DB_APPLICATION_NAME"];
    } catch (error) { }

    if (!connectionName) connectionName = "Buidl3";
  }

  const pool = await createPool(
    url + (connectionName ? `?application_name=${connectionName}` : ''),
    { statementTimeout: 300000, ...client }
  );

  const subscriber = createSubscriber({ connectionString: url });

  const notifications = subscriber.notifications;
  const subscribe = notifications.on;

  function subscribeWithListen(
    ...parameters: Parameters<typeof notifications.on>
  ): ReturnType<typeof notifications.on> {
    const channel = parameters[0] as string;

    const result = subscribe.apply(notifications, parameters);
    subscriber.listenTo(channel);

    return result;
  }

  subscriber.notifications.on = subscribeWithListen;

  await subscriber.connect();

  return {
    ...pool,
    realtime: subscriber,
    ...(QueryMethods as Buidl3QueryMethods),
  };
}
