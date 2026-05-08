export interface Fund {
  id: number;
  name: string;
  ticker: string;
  country: string;
  index_name: string;
  expense_ratio: number;
  pros: string;
  cons: string;
}

export interface FundPrice {
  ticker: string;
  price: number;
  currency: string;
  return1y: number;
  return3y: number;
  return5y: number;
}
