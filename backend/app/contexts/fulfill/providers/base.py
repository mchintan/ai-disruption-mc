from abc import ABC, abstractmethod
from enum import Enum
from pydantic import BaseModel


class TradingMode(str, Enum):
    PAPER = "paper"
    LIVE = "live"


class AccountInfo(BaseModel):
    account_id: str
    buying_power: float
    portfolio_value: float
    cash: float
    currency: str = "USD"
    mode: TradingMode


class Position(BaseModel):
    ticker: str
    qty: float
    market_value: float
    avg_cost: float
    current_price: float
    pct_of_portfolio: float


class OrderSide(str, Enum):
    BUY = "buy"
    SELL = "sell"


class OrderType(str, Enum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    PARTIAL = "partial"
    FILLED = "filled"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class OrderRequest(BaseModel):
    ticker: str
    side: OrderSide
    qty: float
    order_type: OrderType = OrderType.MARKET
    limit_price: float | None = None


class OrderResult(BaseModel):
    order_id: str
    ticker: str
    side: OrderSide
    qty: float
    filled_qty: float = 0.0
    status: OrderStatus
    filled_avg_price: float | None = None
    submitted_at: str = ""
    message: str = ""


class BrokerProvider(ABC):
    """Abstract base class for brokerage integrations."""

    @abstractmethod
    def get_name(self) -> str: ...

    @abstractmethod
    def get_oauth_url(self, redirect_uri: str, state: str) -> str: ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> dict: ...

    @abstractmethod
    async def get_account(self, token: str) -> AccountInfo: ...

    @abstractmethod
    async def get_positions(self, token: str) -> list[Position]: ...

    @abstractmethod
    async def place_order(self, token: str, order: OrderRequest) -> OrderResult: ...

    @abstractmethod
    async def get_order_status(self, token: str, order_id: str) -> OrderResult: ...

    @abstractmethod
    async def cancel_order(self, token: str, order_id: str) -> bool: ...
