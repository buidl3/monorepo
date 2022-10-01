import type { IContract } from "./Concepts";
import type { Network } from "./Network";

export function rehydrate(data) {
  const contract = this as IContract;

  const { ct_tx_top, ct_ev_top } = data;

  if (ct_tx_top !== -1) contract.txTop = ct_tx_top;
  if (ct_ev_top !== -1) contract.evTop = ct_ev_top;

  if (contract.onRehydrate) contract.onRehydrate(data);
}

export class ContractBuilder<Contract extends IContract> {
  contract: Partial<Contract> = {};

  constructor(id: string, network: Network) {
    this.contract.id = id;
    this.contract.network = network;

    this.contract.setup = async (db) => { };
    this.contract.refresh = async (db) => { };
  }

  public setAddress(address: string) {
    this.contract.address = address;
    return this;
  }

  public setGenesis(number: number) {
    this.contract.genesis = number;
    return this;
  }

  public build() {
    this.contract.evTop = this.contract.genesis;
    this.contract.txTop = this.contract.genesis;

    return this.contract;
  }
}

export class GenericContractBuilder extends ContractBuilder<IContract> { }
