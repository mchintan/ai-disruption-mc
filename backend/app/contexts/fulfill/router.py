"""Fulfill context router — brokerage connection, trade generation, order execution."""

import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.contexts.fulfill.providers import get_provider
from app.contexts.fulfill.providers.base import OrderRequest, OrderSide, OrderType
from app.contexts.fulfill.schemas import (
    BrokerConnectionStatus,
    BrokerType,
    ExecuteTradesRequest,
    ExecuteTradesResponse,
    OAuthInitRequest,
    OAuthInitResponse,
    OrderStatusItem,
    TradeListRequest,
    TradeListResponse,
)
from app.contexts.fulfill.token_store import delete_token, get_token, has_token, store_token
from app.contexts.fulfill.trade_generator import generate_trade_list
from app.contexts.observability.journey import emit

router = APIRouter(prefix="/api/fulfill", tags=["fulfill"])

# In-memory state store for OAuth (in production, use Redis)
_oauth_states: dict[str, str] = {}


@router.post("/oauth/init", response_model=OAuthInitResponse)
async def oauth_init(
    req: OAuthInitRequest,
    request: Request,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Start OAuth flow — returns the broker's authorization URL."""
    provider = get_provider(req.broker.value)
    state = secrets.token_urlsafe(32)
    _oauth_states[state] = req.broker.value

    # Build callback URL from the current request
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/fulfill/oauth/callback"

    auth_url = provider.get_oauth_url(redirect_uri, state)
    emit("oauth_initiated", context="fulfill", session=x_session_id, broker=req.broker.value)
    return OAuthInitResponse(auth_url=auth_url, state=state)


@router.get("/oauth/callback")
async def oauth_callback(
    code: str = Query(...),
    state: str = Query(...),
    request: Request = None,
):
    """Handle OAuth callback from broker — store token and redirect to frontend."""
    broker_name = _oauth_states.pop(state, None)
    if not broker_name:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    provider = get_provider(broker_name)
    base_url = str(request.base_url).rstrip("/")
    redirect_uri = f"{base_url}/api/fulfill/oauth/callback"

    token_data = await provider.exchange_code(code, redirect_uri)
    access_token = token_data.get("access_token", "")
    if not access_token:
        raise HTTPException(status_code=400, detail="No access token received from broker")

    # Extract session from state or use a default
    # In production, encode session_id in the state param
    session_id = "default"
    store_token(session_id, broker_name, access_token, token_data.get("refresh_token", ""))

    # Redirect to frontend with connection indicator
    frontend_url = "http://localhost:5173"
    return RedirectResponse(url=f"{frontend_url}?broker_connected={broker_name}")


@router.get("/connection/{broker}", response_model=BrokerConnectionStatus)
async def check_connection(
    broker: BrokerType,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Check if a broker is connected and return account info."""
    session_id = x_session_id or "default"
    token = get_token(session_id, broker.value)

    if not token:
        return BrokerConnectionStatus(broker=broker.value, connected=False)

    try:
        provider = get_provider(broker.value)
        account = await provider.get_account(token)
        return BrokerConnectionStatus(
            broker=broker.value,
            connected=True,
            account_id=account.account_id,
            mode=account.mode.value,
            portfolio_value=account.portfolio_value,
            buying_power=account.buying_power,
        )
    except Exception:
        # Token expired or invalid
        delete_token(session_id, broker.value)
        return BrokerConnectionStatus(broker=broker.value, connected=False)


@router.delete("/connection/{broker}", status_code=204)
async def disconnect(
    broker: BrokerType,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Disconnect a broker — delete stored token."""
    session_id = x_session_id or "default"
    delete_token(session_id, broker.value)
    emit("broker_disconnected", context="fulfill", session=session_id, broker=broker.value)


@router.post("/trade-list", response_model=TradeListResponse)
async def generate_trades(
    req: TradeListRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Generate a trade list from target allocations vs current holdings."""
    session_id = x_session_id or "default"
    token = get_token(session_id, req.broker.value)
    if not token:
        raise HTTPException(status_code=401, detail=f"Not connected to {req.broker.value}. Please connect first.")

    provider = get_provider(req.broker.value)
    account = await provider.get_account(token)
    positions = await provider.get_positions(token)

    trades = generate_trade_list(
        targets=req.targets,
        positions=positions,
        account=account,
        investment_amount=req.investment_amount,
        use_existing=req.use_existing_positions,
    )

    total_buy = sum(t.delta_value for t in trades if t.action.value == "buy")
    total_sell = sum(abs(t.delta_value) for t in trades if t.action.value == "sell")

    emit("trade_list_generated", context="fulfill", session=session_id,
         broker=req.broker.value, trades_count=len(trades))

    return TradeListResponse(
        trades=trades,
        total_buy_value=round(total_buy, 2),
        total_sell_value=round(total_sell, 2),
        net_cash_needed=round(total_buy - total_sell, 2),
        available_cash=round(account.cash, 2),
        portfolio_value=round(account.portfolio_value, 2),
        mode=account.mode.value,
    )


@router.post("/execute", response_model=ExecuteTradesResponse)
async def execute_trades(
    req: ExecuteTradesRequest,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Execute trades. Requires confirm=True as safety gate."""
    if not req.confirm:
        raise HTTPException(status_code=400, detail="confirm must be True to execute trades. This is a safety gate.")

    session_id = x_session_id or "default"
    token = get_token(session_id, req.broker.value)
    if not token:
        raise HTTPException(status_code=401, detail=f"Not connected to {req.broker.value}")

    provider = get_provider(req.broker.value)
    orders: list[OrderStatusItem] = []
    errors: list[str] = []

    for trade in req.trades:
        if trade.action.value == "hold" or trade.shares_to_trade <= 0:
            continue
        try:
            order_req = OrderRequest(
                ticker=trade.ticker,
                side=OrderSide.BUY if trade.action.value == "buy" else OrderSide.SELL,
                qty=trade.shares_to_trade,
                order_type=OrderType.MARKET,
            )
            result = await provider.place_order(token, order_req)
            orders.append(OrderStatusItem(
                order_id=result.order_id,
                ticker=result.ticker,
                side=result.side.value,
                qty=result.qty,
                filled_qty=result.filled_qty,
                status=result.status.value,
                filled_avg_price=result.filled_avg_price,
                message=result.message,
            ))
        except Exception as e:
            errors.append(f"{trade.ticker}: {str(e)}")

    emit("trades_executed", context="fulfill", session=session_id,
         broker=req.broker.value, orders_count=len(orders), errors_count=len(errors))

    return ExecuteTradesResponse(
        orders=orders,
        all_submitted=len(errors) == 0 and len(orders) > 0,
        errors=errors,
    )


@router.get("/orders/{broker}", response_model=list[OrderStatusItem])
async def get_orders(
    broker: BrokerType,
    x_session_id: Optional[str] = Header(default="", alias="X-Session-ID"),
):
    """Get status of recent orders."""
    session_id = x_session_id or "default"
    token = get_token(session_id, broker.value)
    if not token:
        raise HTTPException(status_code=401, detail=f"Not connected to {broker.value}")

    # For now, return empty list — order tracking will use stored order IDs in a future iteration
    return []
