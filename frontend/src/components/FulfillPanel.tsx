import { useState, useEffect, useCallback } from "react";
import {
  Wallet, ChevronDown, ChevronUp, Loader2, Link, Unlink,
  AlertTriangle, CheckCircle2, Clock, XCircle, ArrowRightLeft,
} from "lucide-react";
import {
  initOAuth, checkBrokerConnection, disconnectBroker,
  generateTradeList, executeTrades, getOrderStatus,
} from "../api";
import type {
  BrokerType, BrokerConnectionStatus, TradeItem,
  TradeListResponse, ExecuteTradesResponse, OrderStatusItem,
} from "../types/fulfill";

interface FulfillPanelProps {
  targets: Array<{ ticker: string; name: string; target_pct: number }>;
  investmentAmount: number;
}

type Phase = "connect" | "tradelist" | "execute" | "results";

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

export function FulfillPanel({ targets, investmentAmount }: FulfillPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [phase, setPhase] = useState<Phase>("connect");

  // Connect phase
  const [selectedBroker, setSelectedBroker] = useState<BrokerType>("alpaca");
  const [connection, setConnection] = useState<BrokerConnectionStatus | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Trade list phase
  const [tradeList, setTradeList] = useState<TradeListResponse | null>(null);
  const [generatingTrades, setGeneratingTrades] = useState(false);
  const [tradeError, setTradeError] = useState<string | null>(null);

  // Execute phase
  const [liveConfirmed, setLiveConfirmed] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);

  // Results phase
  const [executeResult, setExecuteResult] = useState<ExecuteTradesResponse | null>(null);
  const [orderStatuses, setOrderStatuses] = useState<OrderStatusItem[] | null>(null);

  // Check for broker_connected URL param on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const brokerConnected = params.get("broker_connected");
    if (brokerConnected === "alpaca" || brokerConnected === "ibkr") {
      setSelectedBroker(brokerConnected);
      setExpanded(true);
      checkConnection(brokerConnected);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("broker_connected");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const checkConnection = useCallback(async (broker: BrokerType) => {
    try {
      const status = await checkBrokerConnection(broker);
      setConnection(status);
      if (status.connected) {
        setPhase("tradelist");
      }
    } catch {
      setConnection(null);
    }
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    setConnectError(null);
    try {
      const { auth_url } = await initOAuth(selectedBroker);
      window.location.href = auth_url;
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectBroker(selectedBroker);
      setConnection(null);
      setPhase("connect");
      setTradeList(null);
      setExecuteResult(null);
      setOrderStatuses(null);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Disconnect failed");
    }
  };

  const handleGenerateTrades = async () => {
    setGeneratingTrades(true);
    setTradeError(null);
    try {
      const res = await generateTradeList({
        broker: selectedBroker,
        targets,
        investment_amount: investmentAmount,
        use_existing_positions: true,
      });
      setTradeList(res);
      setPhase("execute");
    } catch (err) {
      setTradeError(err instanceof Error ? err.message : "Trade generation failed");
    } finally {
      setGeneratingTrades(false);
    }
  };

  const handleExecuteTrades = async () => {
    if (!tradeList) return;
    setExecuting(true);
    setExecuteError(null);
    try {
      const res = await executeTrades({
        broker: selectedBroker,
        trades: tradeList.trades.filter((t) => t.action !== "hold"),
        confirm: true,
      });
      setExecuteResult(res);
      setPhase("results");
      // Fetch order statuses
      try {
        const statuses = await getOrderStatus(selectedBroker);
        setOrderStatuses(statuses);
      } catch {
        // Non-critical, we have the initial response
      }
    } catch (err) {
      setExecuteError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setExecuting(false);
    }
  };

  const actionColor = (action: string) => {
    if (action === "buy") return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10";
    if (action === "sell") return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10";
    return "text-stone-500 dark:text-slate-500 bg-stone-50 dark:bg-slate-800/30";
  };

  const statusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === "filled") return "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-500/10 dark:border-emerald-500/20";
    if (s === "partially_filled" || s === "partial") return "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20";
    if (s === "rejected" || s === "canceled" || s === "cancelled") return "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-500/10 dark:border-red-500/20";
    return "text-stone-600 bg-stone-50 border-stone-200 dark:text-slate-400 dark:bg-slate-800/30 dark:border-slate-700/30";
  };

  const statusIcon = (status: string) => {
    const s = status.toLowerCase();
    if (s === "filled") return <CheckCircle2 className="w-3.5 h-3.5" />;
    if (s === "rejected" || s === "canceled" || s === "cancelled") return <XCircle className="w-3.5 h-3.5" />;
    return <Clock className="w-3.5 h-3.5" />;
  };

  const isLive = connection?.mode === "LIVE" || tradeList?.mode === "live";

  return (
    <div className="bg-white border border-teal-200 dark:bg-slate-900/50 dark:border-teal-500/30 rounded-xl p-6 mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between mb-4"
      >
        <div className="flex items-center gap-2">
          <Wallet className="w-5 h-5 text-teal-600 dark:text-teal-400" />
          <h3 className="text-sm font-mono font-semibold text-teal-600 dark:text-teal-400">
            Execute Portfolio
          </h3>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-stone-400 dark:text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-stone-400 dark:text-slate-500" />
        )}
      </button>

      {expanded && (
        <div>
          {/* Phase indicator */}
          <div className="flex items-center gap-2 mb-6">
            {(["connect", "tradelist", "execute", "results"] as Phase[]).map((p, i) => {
              const labels = ["Connect", "Trade List", "Execute", "Results"];
              const isActive = p === phase;
              const isDone =
                (p === "connect" && connection?.connected) ||
                (p === "tradelist" && tradeList !== null) ||
                (p === "execute" && executeResult !== null) ||
                (p === "results" && executeResult !== null);
              return (
                <div key={p} className="flex items-center gap-2">
                  {i > 0 && <div className="w-6 h-px bg-stone-200 dark:bg-slate-700" />}
                  <span
                    className={`text-xs font-mono px-2 py-1 rounded ${
                      isActive
                        ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-500/10 dark:text-teal-400 dark:border-teal-500/20"
                        : isDone
                          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                          : "text-stone-400 dark:text-slate-600"
                    }`}
                  >
                    {labels[i]}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Phase 1: Connect Broker */}
          {phase === "connect" && (
            <div>
              <p className="text-xs text-stone-500 dark:text-slate-500 mb-4">
                Connect your brokerage account to execute trades based on your optimized portfolio allocations.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* Alpaca card */}
                <button
                  onClick={() => setSelectedBroker("alpaca")}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedBroker === "alpaca"
                      ? "bg-teal-50 border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/30"
                      : "bg-stone-50 border-stone-200 hover:border-stone-300 dark:bg-slate-800/30 dark:border-slate-700/30 dark:hover:border-slate-600/50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-semibold ${
                        selectedBroker === "alpaca"
                          ? "text-teal-700 dark:text-teal-400"
                          : "text-stone-700 dark:text-slate-300"
                      }`}
                    >
                      Alpaca
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                      PAPER / LIVE
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-slate-500">
                    Commission-free stock and ETF trading
                  </div>
                </button>

                {/* IBKR card (disabled) */}
                <div className="p-4 rounded-lg border bg-stone-50 border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 opacity-50 cursor-not-allowed">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-stone-400 dark:text-slate-500">
                      Interactive Brokers
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-stone-100 text-stone-400 border border-stone-200 dark:bg-slate-700/30 dark:text-slate-500 dark:border-slate-600/30">
                      COMING SOON
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-400 dark:text-slate-500">
                    Global multi-asset broker
                  </div>
                </div>
              </div>

              {connection?.connected ? (
                <div className="bg-emerald-50 border border-emerald-200 dark:bg-emerald-500/10 dark:border-emerald-500/20 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        Connected
                      </span>
                    </div>
                    <span
                      className={`text-xs font-mono px-2 py-0.5 rounded border ${
                        connection.mode === "LIVE"
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                          : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                      }`}
                    >
                      {connection.mode}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <div className="text-stone-400 dark:text-slate-500 mb-0.5">Account</div>
                      <div className="font-mono text-stone-700 dark:text-slate-300">{connection.account_id}</div>
                    </div>
                    <div>
                      <div className="text-stone-400 dark:text-slate-500 mb-0.5">Portfolio Value</div>
                      <div className="font-mono text-stone-700 dark:text-slate-300">
                        {connection.portfolio_value != null ? formatCurrency(connection.portfolio_value) : "--"}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400 dark:text-slate-500 mb-0.5">Buying Power</div>
                      <div className="font-mono text-stone-700 dark:text-slate-300">
                        {connection.buying_power != null ? formatCurrency(connection.buying_power) : "--"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setPhase("tradelist")}
                      className="flex-1 py-2 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 hover:opacity-90 transition-all"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Generate Trades
                    </button>
                    <button
                      onClick={handleDisconnect}
                      className="px-3 py-2 rounded-lg border border-stone-200 text-stone-500 hover:text-red-600 dark:border-slate-700/50 dark:text-slate-400 dark:hover:text-red-400 transition-colors text-xs flex items-center gap-1.5"
                    >
                      <Unlink className="w-3.5 h-3.5" />
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleConnect}
                  disabled={connecting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Redirecting to {selectedBroker}...
                    </>
                  ) : (
                    <>
                      <Link className="w-4 h-4" />
                      Connect {selectedBroker === "alpaca" ? "Alpaca" : "IBKR"}
                    </>
                  )}
                </button>
              )}

              {connectError && (
                <div className="mt-3 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
                  {connectError}
                </div>
              )}
            </div>
          )}

          {/* Phase 2: Trade List */}
          {phase === "tradelist" && (
            <div>
              {!tradeList ? (
                <div>
                  <p className="text-xs text-stone-500 dark:text-slate-500 mb-4">
                    Generate a trade list to rebalance your portfolio to the target allocations. This will calculate the
                    exact trades needed based on your current holdings.
                  </p>

                  {isLive && (
                    <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                      <span className="text-xs text-red-600 dark:text-red-400">
                        You are connected in LIVE mode. Trades will use real money.
                      </span>
                    </div>
                  )}

                  <button
                    onClick={handleGenerateTrades}
                    disabled={generatingTrades}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    {generatingTrades ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Calculating trades...
                      </>
                    ) : (
                      <>
                        <ArrowRightLeft className="w-4 h-4" />
                        Generate Trade List
                      </>
                    )}
                  </button>

                  {tradeError && (
                    <div className="mt-3 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
                      {tradeError}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {/* Show trade list, then allow moving to execute */}
                  {renderTradeTable(tradeList, actionColor, isLive)}
                  <button
                    onClick={() => setPhase("execute")}
                    className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  >
                    Review & Execute
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Phase 3: Execute */}
          {phase === "execute" && tradeList && (
            <div>
              {renderTradeTable(tradeList, actionColor, isLive)}

              {isLive && (
                <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 mt-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-700 dark:text-red-400 font-semibold mb-2">
                        LIVE TRADING WARNING
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mb-3">
                        These trades will execute with real money in your brokerage account. This action cannot be undone
                        once orders are submitted.
                      </p>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={liveConfirmed}
                          onChange={(e) => setLiveConfirmed(e.target.checked)}
                          className="rounded border-red-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-xs text-red-700 dark:text-red-400 font-semibold">
                          I understand these are real trades
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleExecuteTrades}
                disabled={executing || (isLive && !liveConfirmed)}
                className={`w-full mt-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all ${
                  isLive
                    ? "bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400"
                    : "bg-gradient-to-r from-teal-600 to-teal-500 dark:from-cyan-500 dark:to-blue-500 text-white hover:opacity-90"
                }`}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting orders...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4" />
                    {isLive ? "Execute Live Trades" : "Execute Paper Trades"}
                  </>
                )}
              </button>

              {executeError && (
                <div className="mt-3 bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 text-red-600 dark:text-red-400 text-sm">
                  {executeError}
                </div>
              )}
            </div>
          )}

          {/* Phase 4: Results */}
          {phase === "results" && executeResult && (
            <div>
              <div
                className={`text-xs font-mono px-3 py-1.5 rounded-lg inline-block mb-4 ${
                  executeResult.all_submitted
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                    : "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                }`}
              >
                {executeResult.all_submitted
                  ? "All orders submitted successfully"
                  : `${executeResult.errors.length} error(s) occurred`}
              </div>

              {executeResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/20 rounded-xl px-4 py-3 mb-4">
                  {executeResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">
                      {err}
                    </p>
                  ))}
                </div>
              )}

              <div className="bg-stone-50 border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-4">
                <h4 className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider mb-3">
                  Order Status
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
                        <th className="text-left pb-2 pr-4">Ticker</th>
                        <th className="text-left pb-2 pr-4">Side</th>
                        <th className="text-right pb-2 pr-4">Qty</th>
                        <th className="text-right pb-2 pr-4">Filled</th>
                        <th className="text-left pb-2 pr-4">Status</th>
                        <th className="text-right pb-2">Avg Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(orderStatuses ?? executeResult.orders).map((order, i) => (
                        <tr key={i} className="border-b border-stone-100 dark:border-slate-800/50">
                          <td className="py-2 pr-4 font-bold text-stone-900 dark:text-slate-200">
                            {order.ticker}
                          </td>
                          <td
                            className={`py-2 pr-4 font-semibold ${
                              order.side.toLowerCase() === "buy"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {order.side.toUpperCase()}
                          </td>
                          <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">{order.qty}</td>
                          <td className="text-right py-2 pr-4 text-stone-600 dark:text-slate-300">
                            {order.filled_qty}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-semibold ${statusBadge(order.status)}`}
                            >
                              {statusIcon(order.status)}
                              {order.status}
                            </span>
                          </td>
                          <td className="text-right py-2 text-stone-600 dark:text-slate-300">
                            {order.filled_avg_price != null ? `$${order.filled_avg_price.toFixed(2)}` : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                onClick={() => {
                  setPhase("connect");
                  setTradeList(null);
                  setExecuteResult(null);
                  setOrderStatuses(null);
                  setLiveConfirmed(false);
                }}
                className="w-full mt-4 py-3 rounded-xl border border-stone-200 text-stone-500 hover:text-stone-700 dark:border-slate-700/50 dark:text-slate-400 dark:hover:text-slate-200 transition-colors text-sm"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function renderTradeTable(
  tradeList: TradeListResponse,
  actionColor: (action: string) => string,
  isLive: boolean | undefined,
) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h4 className="text-xs font-mono font-semibold text-stone-500 dark:text-slate-500 uppercase tracking-wider">
          Trade List
        </h4>
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
            isLive
              ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
          }`}
        >
          {tradeList.mode?.toUpperCase() || "PAPER"}
        </span>
      </div>

      <div className="bg-stone-50 border border-stone-200 dark:bg-slate-800/30 dark:border-slate-700/30 rounded-xl p-4 mb-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="text-stone-500 dark:text-slate-500 border-b border-stone-200 dark:border-slate-700/30">
                <th className="text-left pb-2 pr-3">Ticker</th>
                <th className="text-left pb-2 pr-3">Name</th>
                <th className="text-left pb-2 pr-3">Action</th>
                <th className="text-right pb-2 pr-3">Current %</th>
                <th className="text-right pb-2 pr-3">Target %</th>
                <th className="text-right pb-2 pr-3">Delta $</th>
                <th className="text-right pb-2 pr-3">Shares</th>
                <th className="text-right pb-2">Est. Price</th>
              </tr>
            </thead>
            <tbody>
              {tradeList.trades.map((trade: TradeItem, i: number) => (
                <tr key={i} className="border-b border-stone-100 dark:border-slate-800/50">
                  <td className="py-2 pr-3 font-bold text-stone-900 dark:text-slate-200">{trade.ticker}</td>
                  <td className="py-2 pr-3 text-stone-500 dark:text-slate-400 max-w-[120px] truncate">
                    {trade.name}
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${actionColor(trade.action)}`}>
                      {trade.action}
                    </span>
                  </td>
                  <td className="text-right py-2 pr-3 text-stone-600 dark:text-slate-300">
                    {trade.current_pct.toFixed(1)}%
                  </td>
                  <td className="text-right py-2 pr-3 text-stone-600 dark:text-slate-300">
                    {trade.target_pct.toFixed(1)}%
                  </td>
                  <td
                    className={`text-right py-2 pr-3 font-semibold ${
                      trade.delta_value > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : trade.delta_value < 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-stone-400 dark:text-slate-500"
                    }`}
                  >
                    {trade.delta_value > 0 ? "+" : ""}
                    {formatCurrency(trade.delta_value)}
                  </td>
                  <td className="text-right py-2 pr-3 text-stone-600 dark:text-slate-300">
                    {trade.shares_to_trade}
                  </td>
                  <td className="text-right py-2 text-stone-600 dark:text-slate-300">
                    ${trade.estimated_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-lg p-3">
          <div className="text-[10px] font-mono text-stone-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Total Buys
          </div>
          <div className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(tradeList.total_buy_value)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-lg p-3">
          <div className="text-[10px] font-mono text-stone-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Total Sells
          </div>
          <div className="text-sm font-mono font-bold text-red-600 dark:text-red-400">
            {formatCurrency(tradeList.total_sell_value)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-lg p-3">
          <div className="text-[10px] font-mono text-stone-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Net Cash Needed
          </div>
          <div className="text-sm font-mono font-bold text-stone-900 dark:text-slate-200">
            {formatCurrency(tradeList.net_cash_needed)}
          </div>
        </div>
        <div className="bg-white border border-stone-200 dark:bg-slate-900/50 dark:border-slate-700/30 rounded-lg p-3">
          <div className="text-[10px] font-mono text-stone-400 dark:text-slate-500 uppercase tracking-wider mb-1">
            Available Cash
          </div>
          <div className="text-sm font-mono font-bold text-stone-900 dark:text-slate-200">
            {formatCurrency(tradeList.available_cash)}
          </div>
        </div>
      </div>
    </div>
  );
}
