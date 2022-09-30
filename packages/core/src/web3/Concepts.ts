import type { IRehydratable, Extra } from "../db/Concepts";
import type { Buidl3Database } from "../db/Connection";
import type { ethers } from "ethers";

export interface Block {
  hash: string;
  parent: string;

  number: number;
  chain: number;

  timestamp?: number;

  extra?: any;
  raw?: any;
}

export interface Event {
  block: number;
  blockHash: string;

  index: number;
  topics: Array<string>;
  data: string;

  chain: number;

  extra?: any;
  raw?: any;
}

interface EventFilter extends ethers.providers.Filter {
  transform?: (event: Event) => Extra
}

export interface IContract extends IRehydratable {
  id: string;
  chain: number;

  address?: string;
  genesis?: number;

  // Contract-specific schemas and routines
  setup?: (db: Buidl3Database) => Promise<void>;

  // Refresh database schemas on event insert
  refresh?: (db: Buidl3Database) => Promise<void>;

  // Internals
  txTop?: number;
  evTop?: number;

  filters?: Array<EventFilter>;
}
