import type { IRehydratable, Extra } from "../db/Concepts";
import type { Buidl3Database } from "../db/Connection";
import type { Network } from "./Network";
import type { ethers } from "ethers";

export interface Block {
  hash: string;
  parent: string;

  chain: number;
  number: number;

  timestamp?: number;

  extra?: any;
  raw?: any;
}

export interface Event {
  index: number;
  data: string;
  topics: Array<string>;

  transactionHash: string;

  chain: number;
  block: number;
  blockHash: string;

  extra?: any;
  raw?: any;
}

export interface Transaction {
  hash: string;
  index: number;

  from: string;
  to?: string;
  data: string;

  chain: number;
  block: number;
  blockHash: string;

  extra?: any;
  raw?: any;
}

interface EventFilter extends ethers.providers.Filter {
  transform?: (event: Event) => Extra
}

export interface IContract extends IRehydratable {
  id: string;
  network: Network;

  address?: string;
  genesis?: number;

  // Contract-specific schemas and routines
  setup?: (db: Buidl3Database) => Promise<void>;

  // Cleans up schemas and routines
  destroy?: (db: Buidl3Database) => Promise<void>;

  // Refresh database schemas on event insert
  refresh?: (db: Buidl3Database) => Promise<void>;


  // Internals
  txTop?: number;
  evTop?: number;

  filters?: Array<EventFilter>;
}
