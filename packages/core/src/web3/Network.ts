import type Common from "@ethereumjs/common";

export interface EthersConfig {
  http?: string;
  fallbackHttp?: string;

  ws?: string;
  fallbackWs?: string;

  /** When set it splits getLogs calls into smaller parts (blockticks) **/
  blocktick?: number;
}

export interface P2PConfig {
  /** Ethereum-js common object **/
  common: Common;

  /** Maximum allowed peers, default 50 **/
  peers?: number;
}

export interface CLIConfig {
  /** Default block skip when regenerating blocks **/
  skip?: number;
}

export interface Network {
  name: string;
  chain: number;

  ethers?: EthersConfig;
  p2p?: P2PConfig;
  cli?: CLIConfig;
}
