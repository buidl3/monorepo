import type {
  Buidl3Provider,
  CleanupFunc,
  EventFilter,
  BlockCallback,
  EventCallback,
} from "./Provider";

import type { Block, Event } from "./Concepts";
import { Network } from "./Network";

import { BlockHeader } from "@ethereumjs/block";
import Common from "@ethereumjs/common";
import {
  DPT,
  RLPx,
  ETH,
  Peer as _Peer,
  int2buffer,
  buffer2int,
  DISCONNECT_REASONS,
} from "@ethereumjs/devp2p";

import { randomBytes } from "crypto";
import { EventEmitter } from "stream";

type Peer = _Peer & { peerId: number };

const PRIVATE_KEY = randomBytes(32);

export class P2PProvider implements Buidl3Provider {
  dpt: DPT;
  rlpx: RLPx;
  network: Network;
  common: Common;

  events: EventEmitter;
  peers: Map<number, Peer>;
  requests: RequestManager;

  constructor(network: Network) {
    this.network = network;
    this.common = this.network.p2p?.common!;

    this.events = new EventEmitter();
    this.requests = new RequestManager();

    this.dpt = new DPT(PRIVATE_KEY, {
      refreshInterval: 30000,
      endpoint: {
        address: "0.0.0.0",
        udpPort: null,
        tcpPort: null,
      },
    });

    this.rlpx = new RLPx(PRIVATE_KEY, {
      dpt: this.dpt,
      maxPeers: network.p2p?.peers || 50,
      capabilities: [ETH.eth66],
      common: this.common,
      remoteClientIdFilter: REMOTE_CLIENTID_FILTER,
    });

    this.dpt.on("error", (err) => { });
    this.rlpx.on("error", (err) => { });


    const genesis = this.common.genesis();

    const current = { peerId: 0 };
    this.peers = new Map<number, Peer>();

    this.rlpx.on("peer:added", (peer: Peer) => {
      peer.peerId = current.peerId++;

      const protocol = peer.getProtocols()[0] as any;

      const afkTimeout = setTimeout(() => {
        peer.disconnect(DISCONNECT_REASONS.USELESS_PEER);
      }, 10000);

      protocol.sendStatus({
        td: int2buffer(genesis.difficulty),
        bestHash: Buffer.from(genesis.hash.substring(2), "hex"),
        genesisHash: Buffer.from(genesis.hash.substring(2), "hex"),
      } as any);

      protocol.once("status", (status) => {
        clearTimeout(afkTimeout);

        this.peers.set(peer.peerId, peer);
        this.events.emit("peer:added", peer);
      });

      protocol.on("message", async (code, payload) => {
        if (code === ETH.MESSAGE_CODES.GET_BLOCK_HEADERS) {
          protocol.sendMessage(ETH.MESSAGE_CODES.BLOCK_HEADERS, [
            payload[0],
            [],
          ]);
        }
      });
    });

    this.rlpx.on("peer:removed", (peer: Peer) => {
      this.peers.delete(peer.peerId);
    });

    this.bootstrap();

    /* DEBUG
    setInterval(() => {
      const peersCount = this.dpt.getPeers().length;
      if (peersCount <= 0) this.bootstrap();

      console.log(`Total nodes in DPT: ${peersCount}`);
    }, 5000);
    */
  }

  private bootstrap() {
    const nodes = this.common.bootstrapNodes();
    const BOOTNODES = nodes.map((node) => {
      return {
        address: node.ip,
        udpPort: node.port,
        tcpPort: node.port,
      };
    });

    BOOTNODES.push({
      address: "65.108.70.101",
      udpPort: 30303,
      tcpPort: 30303,
    });

    BOOTNODES.push({
      address: "157.90.35.166",
      udpPort: 30303,
      tcpPort: 30303,
    });

    for (const node of BOOTNODES)
      this.dpt.bootstrap(node as any).catch((err) => { });
  }

  getChain(): number {
    return this.network.chain;
  }

  getLatestBlock(): Promise<Block> {
    throw "getLatestBlock is not supported for P2P!";
  }

  async getBlock(number: number): Promise<Block> {
    let block: any = null;

    var resolve;
    const done = new Promise((f) => {
      resolve = f;
    });

    const common = this.network;

    const requestBlock = async (protocol) => {
      const nextIndex = await this.requests.next("GET_ONE", number);

      protocol.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [
        Buffer.from([nextIndex]),
        [
          int2buffer(number),
          Buffer.from([1]),
          Buffer.from([]),
          Buffer.from([1]),
        ],
      ]);
    };

    const onMessage = async (protocol, code, payload) => {
      const index = buffer2int(payload[0]);
      const request = this.requests.at(index);

      if (!request) return;
      if (request.type !== "GET_ONE" && request.extra !== number) return;

      if (code === ETH.MESSAGE_CODES.BLOCK_HEADERS) {
        const header = this.parseHeader(common, payload);
        if (!header) return requestBlock(protocol);

        this.requests.done(index);

        block = this.toBlock(header);
        return resolve();
      }

      requestBlock(protocol);
    };

    const $onMessage = curry(onMessage);
    function handlePeer(peer) {
      if (!peer) return;

      const protocol = (peer as Peer).getProtocols()[0];
      protocol.on("message", $onMessage(protocol));
      requestBlock(protocol);
    }

    for (const [_, peer] of this.peers) handlePeer(peer);
    this.events.on("peer:added", handlePeer);

    await done;

    this.events.removeListener("peer:added", handlePeer);
    return block as Block;
  }

  async getBlocks(
    from: number,
    to: number,
    onBlock?: (block: Block) => void
  ): Promise<Array<Block>> {
    const blocks: Array<Block> = [];

    var resolve;
    const done = new Promise((r) => {
      resolve = r;
    });

    const parent = await this.getBlock(from - 1);

    const common = this.network;
    const current = {
      block: from,
      parent: Buffer.from(parent.hash, "hex"),
    };

    const requestNextBlock = async (protocol) => {
      if (current.block > to) return resolve();

      const nextIndex = await this.requests.next("GET", current.block);

      protocol.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [
        Buffer.from([nextIndex]),
        [
          int2buffer(current.block),
          Buffer.from([1]),
          Buffer.from([]),
          Buffer.from([1]),
        ],
      ]);
    };

    const onMessage = async (protocol, code, payload) => {
      const index = buffer2int(payload[0]);
      const request = this.requests.at(index);

      if (!request) return;
      if (request.type !== "GET") return;

      if (code === ETH.MESSAGE_CODES.BLOCK_HEADERS) {
        const header = this.parseHeader(common, payload);
        if (!header) return;

        if (Buffer.compare(header.parentHash, current.parent) == 0) {
          request.extra = header;
          protocol.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_BODIES, [
            payload[0],
            [header.hash()],
          ]);

          const block = this.toBlock(header);

          blocks.push(block);
          ++current.block, (current.parent = header.hash());

          if (onBlock) onBlock(block);
        }
      }

      requestNextBlock(protocol);
    };

    const $onMessage = curry(onMessage);
    function handlePeer(peer) {
      const protocol = (peer as Peer).getProtocols()[0];
      protocol.on("message", $onMessage(protocol));
      requestNextBlock(protocol);
    }

    for (const [_, peer] of this.peers) handlePeer(peer);
    this.events.on("peer:added", handlePeer);

    await done;

    this.events.removeListener("peer:added", handlePeer);
    return blocks;
  }

  public watchBlocks(onBlock): () => void {
    const common = this.common;
    const current = {
      block: 1,
      parent: Buffer.from(
        "d4e56740f876aef8c010b86a40d5f56745a118d0906a34e69aec8c0db1cb8fa3",
        "hex"
      ),
      counter: 0,
    };

    const requestNextBlock = async (protocol) => {
      const nextIndex = await this.requests.next("WATCH");

      protocol.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_HEADERS, [
        Buffer.from([nextIndex]),
        [
          int2buffer(current.block),
          Buffer.from([1]),
          Buffer.from([]),
          Buffer.from([1]),
        ],
      ]);
    };

    const onMessage = async (protocol, code, payload) => {
      const index = buffer2int(payload[0]);
      const request = this.requests.at(index);

      if (!request) return;
      if (request.type !== "WATCH") return;

      switch (code) {
        case ETH.MESSAGE_CODES.BLOCK_HEADERS: {
          if (!payload?.[1] || payload[1].length > 1) break; // More than one block

          const header = BlockHeader.fromValuesArray(payload[1][0], {
            common,
          });

          if (Buffer.compare(header.parentHash, current.parent) == 0) {
            request.extra = header;

            protocol.sendMessage(ETH.MESSAGE_CODES.GET_BLOCK_BODIES, [
              payload[0],
              [header.hash()],
            ]);

            current.parent = header.hash();
            ++current.block;
          } else requestNextBlock(protocol);

          break;
        }
        case ETH.MESSAGE_CODES.BLOCK_BODIES: {
          const header = request.extra as BlockHeader;
          if (!header) return;

          this.requests.done(index);
          requestNextBlock(protocol);
          ++current.counter;
          break;
        }
      }
    };

    const $onMessage = curry(onMessage);
    function handlePeer(peer) {
      const protocol = (peer as Peer).getProtocols()[0];
      protocol.on("message", $onMessage(protocol));
      requestNextBlock(protocol);
    }

    for (const [_, peer] of this.peers) handlePeer(peer);
    this.events.on("peer:added", handlePeer);

    return () => {
      this.events.removeListener("peer:added", handlePeer);
    };
  }

  public getEvents(
    filter: EventFilter,
    from: number,
    to: number
  ): Promise<Array<Event>> {
    throw "Not implemented";
  }

  watchEvents(filter: EventFilter, onEvent: EventCallback): CleanupFunc {
    throw "Not implemented";
  }

  private parseHeader(common, payload: any) {
    if (!payload?.[1] || payload[1].length > 1) return null; // More than one block

    try {
      return BlockHeader.fromValuesArray(payload[1][0], { common });
    } catch (error) {
      return null;
    }
  }

  private toBlock(block: BlockHeader): Block {
    return {
      hash: block.hash().toString("hex"),
      parent: block.parentHash.toString("hex"),
      timestamp: block.timestamp.toNumber(),
      number: block.number.toNumber(),
      chain: this.network.chain,
      raw: block,
    };
  }
}

type Request = { type: string; extra: any; _timeout: NodeJS.Timeout };
class RequestManager {
  queue: Array<any>;
  requests: { [index: number]: Request };

  index: number;

  constructor() {
    this.requests = {};
    this.queue = [];

    this.index = 0;
  }

  async next(type: string, extra: any = "") {
    if (Object.keys(this.requests).length >= 255)
      await new Promise((resolve) => this.queue.push(resolve));

    let index = ++this.index % 255;
    while (this.requests[index]) index = ++this.index % 255;

    const timeout = setTimeout(() => this.done(index), 10000);
    this.requests[index] = { type, extra, _timeout: timeout };
    return index;
  }

  clear(peer: any) { }

  done(index: number) {
    clearTimeout(this.requests[index]._timeout);
    delete this.requests[index];

    this.queue.shift()?.();
  }

  at(index: number) {
    return this.requests[index];
  }
}

const REMOTE_CLIENTID_FILTER = [
  "go1.5",
  "go1.6",
  "go1.7",
  "Geth/v1.7",
  "quorum",
  "pirl",
  "ubiq",
  "gmc",
  "gwhale",
  "prichain",
];

function curry(f) {
  return function (a) {
    return function (b, c) {
      return f(a, b, c);
    };
  };
}

function isValidTx(tx) {
  return tx.validate();
}

async function isValidBlock(block) {
  return (
    block.validateUnclesHash() &&
    block.transactions.every(isValidTx) &&
    block.validateTransactionsTrie()
  );
}

