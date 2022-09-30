import type { Buidl3Database } from "./db/Connection";
import type { Buidl3Provider, CleanupFunc, EventCallback } from "./web3/Provider";
import type { IContract } from "./web3/Concepts";

import { sql } from "slonik";

export class Buidl3 {
  db: Buidl3Database;
  provider: Buidl3Provider;

  constructor(db: Buidl3Database, provider: Buidl3Provider) {
    this.db = db;
    this.provider = provider;
  }

  async restoreEvents(contract: IContract) {
    if (!contract.filters) return;
    if (!contract.evTop || contract.evTop < 1) throw "Event top is invalid!";

    const top = await this.provider.getLatestBlock();

    for (const filter of contract.filters) {
      const events = await this.provider.getEvents(
        filter,
        contract.evTop as number,
        top.number
      );

      for (const event of events) {
        const extra = filter.transform ? filter.transform(event) : undefined;
        await this.db.putEvent(event, extra);
      }
    }

    await contract.refresh?.(this.db);
    await this.db.query(sql`UPDATE contracts SET ct_ev_top = ${top.number} WHERE ct_id = ${contract.id}`);
  }

  watchEvents(contract: IContract, onEvent: EventCallback, upsert: boolean = false): CleanupFunc {
    if (!contract.filters) return () => { };

    const listeners: Array<CleanupFunc> = [];

    for (const filter of contract.filters) {
      const unsubscribe = this.provider.watchEvents(filter, async event => {
        const extra = filter.transform ? filter.transform(event) : undefined;
        event.extra = extra;

        onEvent(event);

        if (upsert) {
          await this.db.putEvent(event, extra)
          await contract.refresh?.(this.db);
        }
      });

      listeners.push(unsubscribe);
    }

    return () => {
      listeners.forEach(unsubscribe => unsubscribe());
    }
  }
}
