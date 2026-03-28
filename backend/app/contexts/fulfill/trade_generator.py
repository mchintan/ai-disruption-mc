"""Generate trade list from target allocations vs current positions."""

import math

from app.contexts.fulfill.providers.base import AccountInfo, Position
from app.contexts.fulfill.schemas import TargetAllocation, TradeAction, TradeItem


def generate_trade_list(
    targets: list[TargetAllocation],
    positions: list[Position],
    account: AccountInfo,
    investment_amount: float,
    use_existing: bool,
) -> list[TradeItem]:
    """
    Compute buy/sell trades needed to reach target allocations.

    If use_existing=True: rebalance current holdings to match targets.
    If use_existing=False: deploy investment_amount as fresh capital.
    """
    # Build position lookup
    pos_map: dict[str, Position] = {p.ticker: p for p in positions}

    # Total portfolio value
    if use_existing and account.portfolio_value > 0:
        total_value = account.portfolio_value
    else:
        total_value = investment_amount

    trades: list[TradeItem] = []
    target_tickers: set[str] = set()

    for target in targets:
        target_tickers.add(target.ticker)
        target_value = total_value * (target.target_pct / 100.0)

        pos = pos_map.get(target.ticker)
        if pos and use_existing:
            current_value = pos.market_value
            current_pct = pos.pct_of_portfolio
            current_price = pos.current_price
        else:
            current_value = 0.0
            current_pct = 0.0
            # Use a placeholder price - in production, fetch from market data
            current_price = 100.0  # Will be overridden by broker API

        delta = target_value - current_value

        # Determine action
        threshold = max(10.0, total_value * 0.005)  # $10 or 0.5% of portfolio
        if abs(delta) < threshold:
            action = TradeAction.HOLD
            shares = 0.0
        elif delta > 0:
            action = TradeAction.BUY
            shares = math.floor(abs(delta) / current_price) if current_price > 0 else 0.0
        else:
            action = TradeAction.SELL
            shares = math.floor(abs(delta) / current_price) if current_price > 0 else 0.0

        if shares > 0 or action == TradeAction.HOLD:
            trades.append(TradeItem(
                ticker=target.ticker,
                name=target.name or target.ticker,
                action=action,
                current_pct=round(current_pct, 2),
                target_pct=round(target.target_pct, 2),
                current_value=round(current_value, 2),
                target_value=round(target_value, 2),
                delta_value=round(delta, 2),
                shares_to_trade=shares,
                estimated_price=round(current_price, 2),
            ))

    # Positions not in targets — sell all
    if use_existing:
        for ticker, pos in pos_map.items():
            if ticker not in target_tickers and pos.qty > 0:
                trades.append(TradeItem(
                    ticker=ticker,
                    name=ticker,
                    action=TradeAction.SELL,
                    current_pct=round(pos.pct_of_portfolio, 2),
                    target_pct=0.0,
                    current_value=round(pos.market_value, 2),
                    target_value=0.0,
                    delta_value=round(-pos.market_value, 2),
                    shares_to_trade=pos.qty,
                    estimated_price=round(pos.current_price, 2),
                ))

    return trades
