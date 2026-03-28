"""Alpaca brokerage provider implementation."""

import os
from datetime import datetime, timezone

import httpx

from app.contexts.fulfill.providers.base import (
    AccountInfo, BrokerProvider, OrderRequest, OrderResult,
    OrderSide, OrderStatus, Position, TradingMode,
)


class AlpacaProvider(BrokerProvider):
    def __init__(self):
        mode = os.getenv("DEFAULT_TRADING_MODE", "paper")
        if mode == "live":
            self.base_url = os.getenv("ALPACA_LIVE_BASE_URL", "https://api.alpaca.markets")
            self.mode = TradingMode.LIVE
        else:
            self.base_url = os.getenv("ALPACA_PAPER_BASE_URL", "https://paper-api.alpaca.markets")
            self.mode = TradingMode.PAPER
        self.oauth_base = "https://app.alpaca.markets"
        self.client_id = os.getenv("ALPACA_CLIENT_ID", "")
        self.client_secret = os.getenv("ALPACA_CLIENT_SECRET", "")

    def get_name(self) -> str:
        return "alpaca"

    def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        return (
            f"{self.oauth_base}/oauth/authorize"
            f"?response_type=code"
            f"&client_id={self.client_id}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
            f"&scope=account:write%20trading"
        )

    async def exchange_code(self, code: str, redirect_uri: str) -> dict:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.oauth_base}/oauth/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": redirect_uri,
                },
            )
            resp.raise_for_status()
            return resp.json()

    def _headers(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}", "Accept": "application/json"}

    async def get_account(self, token: str) -> AccountInfo:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/v2/account", headers=self._headers(token))
            resp.raise_for_status()
            data = resp.json()
            return AccountInfo(
                account_id=data["id"],
                buying_power=float(data["buying_power"]),
                portfolio_value=float(data["portfolio_value"]),
                cash=float(data["cash"]),
                currency=data.get("currency", "USD"),
                mode=self.mode,
            )

    async def get_positions(self, token: str) -> list[Position]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{self.base_url}/v2/positions", headers=self._headers(token))
            resp.raise_for_status()
            positions = []
            for p in resp.json():
                market_val = float(p["market_value"])
                positions.append(Position(
                    ticker=p["symbol"],
                    qty=float(p["qty"]),
                    market_value=market_val,
                    avg_cost=float(p["avg_entry_price"]),
                    current_price=float(p["current_price"]),
                    pct_of_portfolio=0.0,  # computed after totaling
                ))
            # Compute pct_of_portfolio
            total = sum(pos.market_value for pos in positions)
            if total > 0:
                for pos in positions:
                    pos.pct_of_portfolio = round(pos.market_value / total * 100, 2)
            return positions

    async def place_order(self, token: str, order: OrderRequest) -> OrderResult:
        body: dict = {
            "symbol": order.ticker,
            "qty": str(order.qty),
            "side": order.side.value,
            "type": order.order_type.value,
            "time_in_force": "day",
        }
        if order.limit_price is not None:
            body["limit_price"] = str(order.limit_price)

        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/v2/orders",
                headers=self._headers(token),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json()
            return self._parse_order(data)

    async def get_order_status(self, token: str, order_id: str) -> OrderResult:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/v2/orders/{order_id}",
                headers=self._headers(token),
            )
            resp.raise_for_status()
            return self._parse_order(resp.json())

    async def cancel_order(self, token: str, order_id: str) -> bool:
        async with httpx.AsyncClient() as client:
            resp = await client.delete(
                f"{self.base_url}/v2/orders/{order_id}",
                headers=self._headers(token),
            )
            return resp.status_code in (200, 204)

    def _parse_order(self, data: dict) -> OrderResult:
        status_map = {
            "new": OrderStatus.SUBMITTED,
            "accepted": OrderStatus.SUBMITTED,
            "pending_new": OrderStatus.PENDING,
            "partially_filled": OrderStatus.PARTIAL,
            "filled": OrderStatus.FILLED,
            "canceled": OrderStatus.CANCELLED,
            "expired": OrderStatus.CANCELLED,
            "rejected": OrderStatus.REJECTED,
            "pending_cancel": OrderStatus.PENDING,
            "pending_replace": OrderStatus.PENDING,
        }
        return OrderResult(
            order_id=data["id"],
            ticker=data["symbol"],
            side=OrderSide(data["side"]),
            qty=float(data["qty"]),
            filled_qty=float(data.get("filled_qty", 0)),
            status=status_map.get(data["status"], OrderStatus.PENDING),
            filled_avg_price=float(data["filled_avg_price"]) if data.get("filled_avg_price") else None,
            submitted_at=data.get("submitted_at", ""),
            message="",
        )
