import type {
  Buidl3Provider,
  CleanupFunc,
  EventCallback,
  EventFilter,
} from "./Provider";
import type { Block, Event } from "./Concepts";

import { Network } from "./Network";
import { ethers } from "ethers";

export class EthersProvider implements Buidl3Provider {
  network: Network;
  provider: ethers.providers.WebSocketProvider;

  constructor(network: Network) {
    this.network = network;
    this.provider = new ethers.providers.WebSocketProvider(
      this.network.ethers?.ws!,
      this.network.chain
    );
  }

  getChain(): number {
    return this.provider.network.chainId;
  }

  async getLatestBlock() {
    const top = await this.provider.getBlockNumber();
    const block = await this.provider.getBlock(top);

    return this.parseBlock(block);
  }

  async getBlock(number: number) {
    const block = await this.provider.getBlock(number);
    return this.parseBlock(block);
  }

  async getBlocks(
    from: number,
    to: number,
    onBlock?: (block: Block) => void
  ): Promise<Array<Block>> {
    let i = from;

    const blocks: Array<Block> = [];

    while (i < to) {
      const block = this.parseBlock(await this.provider.getBlock(i++));
      if (!!onBlock) onBlock(block);

      blocks.push(block);
    }

    return blocks;
  }

  watchBlocks(onBlock) {
    async function handleBlock(blockNumber) {
      const block = await this.getBlock(blockNumber);
      onBlock(this.parseBlock(block));
    }

    this.provider.on("block", handleBlock);
    return () => {
      this.provider.off("block", handleBlock);
    };
  }

  async getEvents(
    filter: EventFilter,
    from: number,
    to: number
  ): Promise<Event[]> {
    let logs: ethers.providers.Log[] = [];

    if (this.network?.ethers?.blocktick) {
      const span = this.network.ethers?.blocktick;
      if (isNaN(span) || span <= 0) throw "Invalid blocktick value";

      const blocktick = nextBlocktick(from, to, span);

      let current = blocktick.next();
      while (!current.done) {
        const [$from, $to] = current.value;

        filter.fromBlock = $from;
        filter.toBlock = $to;

        logs.push(...await this.provider.getLogs(filter));

        current = blocktick.next();
      }
    } else {
      // Full fetch
      filter.fromBlock = from;
      filter.toBlock = to;

      logs = await this.provider.getLogs(filter);
    }

    return logs.map((log) => this.parseEvent(log));
  }

  watchEvents(filter: any, onEvent: EventCallback): CleanupFunc {
    const process = (log: ethers.providers.Log) => {
      return onEvent(this.parseEvent(log));
    }

    this.provider.on(filter, process);
    return () => this.provider.off(filter, process);
  }

  public parseBlock(block: ethers.providers.Block): Block {
    return {
      hash: block?.hash,
      parent: block?.parentHash,
      number: block?.number,
      timestamp: block?.timestamp,
      chain: this.network.chain,

      raw: block,
    };
  }

  public parseEvent(event: ethers.providers.Log): Event {
    return {
      block: event.blockNumber,
      blockHash: event.blockHash,
      index: event.logIndex,
      data: event.data,
      topics: event.topics,
      chain: this.network.chain,

      raw: event,
    };
  }
}

function* nextBlocktick(
  fromBlock: number,
  toBlock: number,
  span: number = 10000
) {
  const splits = Math.ceil((toBlock - fromBlock) / span);
  for (let i = 1; i <= splits; ++i) {
    let from = fromBlock + (i - 1) * span;
    const to = Math.min(toBlock, from + span);

    if (i > 1) from = from + 1;

    yield [from, to];
  }
}
