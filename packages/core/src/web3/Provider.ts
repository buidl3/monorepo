import type { Block, Event } from "./Concepts";
import { ethers } from "ethers";

export type EventFilter = ethers.providers.Filter;

export type CleanupFunc = () => void;
export type BlockCallback = (block: Block) => void;
export type EventCallback = (event: Event) => void;

export interface Buidl3Provider {
  getChain(): number;

  getLatestBlock(): Promise<Block>;
  getBlock(from: number): Promise<Block>;
  getBlocks(
    from: number,
    to: number,
    onBlock?: BlockCallback
  ): Promise<Array<Block>>;
  watchBlocks(onBlock: BlockCallback): CleanupFunc;

  getEvents(
    filter: EventFilter,
    from: number,
    to: number
  ): Promise<Array<Event>>;
  watchEvents(filter, onEvent: EventCallback): CleanupFunc;
}