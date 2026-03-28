"""Pydantic schemas for the fulfill bounded context."""

from enum import Enum
from pydantic import BaseModel, Field


class BrokerType(str, Enum):
    ALPACA = "alpaca"
    IBKR = "ibkr"


class BrokerConnectionStatus(BaseModel):
    broker: str
    connected: bool
    account_id: str | None = None
    mode: str | None = None
    portfolio_value: float | None = None
    buying_power: float | None = None


class TargetAllocation(BaseModel):
    ticker: str
    name: str = ""
    target_pct: float = Field(ge=0, le=100)


class TradeAction(str, Enum):
    BUY = "buy"
    SELL = "sell"
    HOLD = "hold"


class TradeItem(BaseModel):
    ticker: str
    name: str
    action: TradeAction
    current_pct: float
    target_pct: float
    current_value: float
    target_value: float
    delta_value: float
    shares_to_trade: float
    estimated_price: float


class TradeListRequest(BaseModel):
    broker: BrokerType
    targets: list[TargetAllocation]
    investment_amount: float = Field(gt=0)
    use_existing_positions: bool = Field(
        default=True,
        description="If True, rebalance from current holdings. If False, treat as fresh investment.",
    )


class TradeListResponse(BaseModel):
    trades: list[TradeItem]
    total_buy_value: float
    total_sell_value: float
    net_cash_needed: float
    available_cash: float
    portfolio_value: float
    mode: str


class ExecuteTradesRequest(BaseModel):
    broker: BrokerType
    trades: list[TradeItem]
    confirm: bool = Field(
        default=False,
        description="Must be True to execute. Safety gate.",
    )


class OrderStatusItem(BaseModel):
    order_id: str
    ticker: str
    side: str
    qty: float
    filled_qty: float
    status: str
    filled_avg_price: float | None = None
    message: str = ""


class ExecuteTradesResponse(BaseModel):
    orders: list[OrderStatusItem]
    all_submitted: bool
    errors: list[str]


class OAuthInitRequest(BaseModel):
    broker: BrokerType


class OAuthInitResponse(BaseModel):
    auth_url: str
    state: str
