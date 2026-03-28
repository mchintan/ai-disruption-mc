export type BrokerType = "alpaca" | "ibkr";

export interface BrokerConnectionStatus {
  broker: string;
  connected: boolean;
  account_id: string | null;
  mode: string | null;
  portfolio_value: number | null;
  buying_power: number | null;
}

export type TradeAction = "buy" | "sell" | "hold";

export interface TradeItem {
  ticker: string;
  name: string;
  action: TradeAction;
  current_pct: number;
  target_pct: number;
  current_value: number;
  target_value: number;
  delta_value: number;
  shares_to_trade: number;
  estimated_price: number;
}

export interface TradeListRequest {
  broker: BrokerType;
  targets: Array<{ ticker: string; name: string; target_pct: number }>;
  investment_amount: number;
  use_existing_positions: boolean;
}

export interface TradeListResponse {
  trades: TradeItem[];
  total_buy_value: number;
  total_sell_value: number;
  net_cash_needed: number;
  available_cash: number;
  portfolio_value: number;
  mode: string;
}

export interface ExecuteTradesRequest {
  broker: BrokerType;
  trades: TradeItem[];
  confirm: boolean;
}

export interface OrderStatusItem {
  order_id: string;
  ticker: string;
  side: string;
  qty: number;
  filled_qty: number;
  status: string;
  filled_avg_price: number | null;
  message: string;
}

export interface ExecuteTradesResponse {
  orders: OrderStatusItem[];
  all_submitted: boolean;
  errors: string[];
}
