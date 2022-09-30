export interface IRehydratable {
  onRehydrate?(data: any): void;
}

export interface Extra {
  [key: string]: any;
}
