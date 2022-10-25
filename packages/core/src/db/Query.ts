import type { Buidl3Database } from "./Connection";
import type { DatabasePool, QueryResult, QueryResultRow } from "slonik";
import { sql } from "slonik";

import type { Extra } from "./Concepts";
import type { IContract, Block, Transaction, Event } from "../web3/Concepts";
import { rehydrate } from "../web3/Contract";

export type Buidl3QueryMethods = {
  attach(contract: IContract): Promise<boolean>;
  sync(contract: IContract): Promise<void>;

  putBlock(block: Block, extra?: Extra): Promise<boolean>;
  putTransaction(transaction: Transaction, extra?: Extra): Promise<boolean>;
  putEvent(event: Event, extra?: Extra): Promise<boolean>;

  getContracts(): Promise<QueryResult<QueryResultRow>>;
  getBlocks(from: number, to: number): Promise<QueryResult<QueryResultRow>>;
};

async function attach(contract: IContract) {
  const pool = this as Buidl3Database;

  const { id = "", network, address = "", genesis = -1 } = contract;

  await pool.query(sql`
    INSERT INTO contracts (ct_id, ct_chain, ct_address, ct_tx_top, ct_ev_top)
    VALUES (${id}, ${network.chain}, ${address}, ${genesis}, ${genesis})
    ON CONFLICT DO NOTHING
  `);

  await sync.call(this, contract);

  pool.realtime.notifications.on("ct_rehydrate", (payload) => {
    if (payload?.record?.ct_id !== id) return;
    rehydrate.call(contract, payload?.record);
  });

  return true;
}

async function sync(contract: IContract) {
  const pool = this as Buidl3Database;

  const { id = "" } = contract;
  const data = await pool.one(sql`SELECT * FROM contracts WHERE ct_id = ${id}`);

  rehydrate.call(contract, data);
}

async function getContracts() {
  const pool = this as Buidl3Database;

  return pool.query(sql`SELECT * FROM contracts`);
}

async function putBlock(block: Block, extra: Extra | null = null): Promise<boolean> {
  const pool = this as Buidl3Database;

  const $extra = extra ? JSON.stringify(extra) : '{}';
  const $raw = block?.raw ? JSON.stringify(block.raw) : null;

  await pool.query(sql`
    INSERT INTO blocks (bl_hash, bl_parent, bl_number, bl_timestamp, bl_chain, bl_extra, bl_raw)
    VALUES (${block.hash}, ${block.parent}, ${block.number}, to_timestamp(${block.timestamp!}), ${block.chain}, ${$extra}, ${$raw})
    ON CONFLICT (bl_number, bl_hash, bl_chain) DO UPDATE
    SET bl_extra = ${$extra}, bl_raw = ${$raw}
  `);

  return true;
}

async function getBlocks(from: number, to: number = Number.MAX_SAFE_INTEGER) {
  const pool = this as Buidl3Database;

  return pool.query(
    sql`SELECT * FROM blocks WHERE bl_number >= ${from} AND bl_number <= ${to}`
  );
}

async function putTransaction(transaction: Transaction, extra?: Extra): Promise<boolean> {
  const pool = this as Buidl3Database;

  const $extra = extra ? JSON.stringify(extra) : '{}';
  const $raw = transaction?.raw ? JSON.stringify(transaction.raw) : null;

  await pool.query(sql`
    INSERT INTO transactions (tx_hash, tx_index, tx_from, tx_to, tx_data, tx_block, tx_block_hash, tx_chain, tx_extra, tx_raw)
    VALUES (
      ${transaction.hash},
      ${transaction.index},
      ${transaction.from},
      ${transaction.to || null},
      ${transaction.data || null},
      ${transaction.block},
      ${transaction.blockHash},
      ${transaction.chain},
      ${$extra}, ${$raw}
    )
    ON CONFLICT(tx_block, tx_hash, tx_chain) DO UPDATE
    SET tx_extra = ${$extra}, tx_raw = ${$raw}
  `);

  return true;
}

async function putEvent(event: Event, extra?: Extra): Promise<boolean> {
  const pool = this as Buidl3Database;

  const $extra = extra ? JSON.stringify(extra) : '{}';
  const $raw = event?.raw ? JSON.stringify(event.raw) : null;

  await pool.query(sql`
    INSERT INTO events(ev_block, ev_bhash, ev_txhash, ev_index, ev_data, ev_topics, ev_chain, ev_extra, ev_raw)
    VALUES(${event.block}, ${event.blockHash}, ${event.transactionHash}, ${event.index}, ${event.data}, ${sql.array(event.topics, "text")}, ${event.chain}, ${$extra}, ${$raw})
    ON CONFLICT(ev_block, ev_bhash, ev_index, ev_chain) DO UPDATE
    SET ev_extra = ${$extra}, ev_raw = ${$raw}
    `);

  return true;
}

export { attach, sync, getContracts, getBlocks, putBlock, putTransaction, putEvent };
