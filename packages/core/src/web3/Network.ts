import Common, {
  CommonOpts,
  Chain,
  Hardfork,
  CustomCommonOpts,
  CustomChain,
} from "@ethereumjs/common";

export interface EthersConfig {
  http?: string;
  fallbackHttp?: string;

  ws?: string;
  fallbackWs?: string;

  /** When set it splits getLogs calls into smaller parts (blockticks) **/
  blocktick?: number;
}

export interface P2PConfig {
  peers?: number;
}

export interface CLIConfig {
  skip?: number;
}

interface NetworkOpts {
  name: string;
  chain: number | CustomChain;

  common?: CustomCommonOpts;
  ethers?: EthersConfig;
  p2p?: P2PConfig;
  cli?: CLIConfig;
}

export { Chain, Hardfork };
export interface Network extends Common {
  ethers?: EthersConfig;
  p2p?: P2PConfig;
}

export function createNetwork(config: NetworkOpts): Network {
  const chain = typeof config?.chain === "object"
    ? config.chain
    : { chainId: config.chain };

  const network = Common.custom(
    {
      name: config.name,
      ...chain,
    },
    config?.common
  );

  network["meta"] = {
    name: config?.name,
    chain: config?.chain,
  };

  network["ethers"] = config?.ethers;
  network["p2p"] = config?.p2p;
  network["cli"] = config?.cli;

  return network;
}

