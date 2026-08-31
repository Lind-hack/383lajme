const DAY_MS = 86_400_000;

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function asMarket(row) {
  if (!row) return null;
  return Array.isArray(row) ? row[0] ?? null : row;
}

export function outcomePrices(market) {
  if (!market) return {};
  const outcomes = Array.isArray(market.sport_outcomes) ? market.sport_outcomes : [];
  const quantities = market.outcome_quantities;
  const liquidity = finite(market.b);
  if (outcomes.length >= 2 && quantities && typeof quantities === "object" && liquidity > 0) {
    const rows = outcomes.map((outcome) => ({
      key: String(outcome?.key ?? ""),
      quantity: finite(quantities?.[String(outcome?.key ?? "")]),
    })).filter((row) => row.key);
    const pivot = Math.max(...rows.map((row) => row.quantity));
    const weights = rows.map((row) => ({ ...row, weight: Math.exp((row.quantity - pivot) / liquidity) }));
    const total = weights.reduce((sum, row) => sum + row.weight, 0);
    if (total > 0) return Object.fromEntries(weights.map((row) => [row.key, row.weight / total]));
  }

  if (liquidity > 0) {
    const yes = Math.exp((finite(market.q_yes) - Math.max(finite(market.q_yes), finite(market.q_no))) / liquidity);
    const no = Math.exp((finite(market.q_no) - Math.max(finite(market.q_yes), finite(market.q_no))) / liquidity);
    const total = yes + no;
    return { PO: yes / total, JO: no / total };
  }
  return {};
}

function outcomeMeta(market, key) {
  const outcomes = Array.isArray(market?.sport_outcomes) ? market.sport_outcomes : [];
  const row = outcomes.find((outcome) => String(outcome?.key ?? "") === String(key));
  return {
    label: String(row?.label ?? row?.team ?? key ?? ""),
    team: row?.team ? String(row.team) : null,
    color: row?.color ?? row?.team_color ?? row?.team_colour ?? null,
    logo: row?.logo ?? null,
    headshotUrl: row?.headshot_url ?? null,
  };
}

function sellKind(market) {
  if (market?.market_type === "f1_race_winner" || market?.market_type === "f1_championship_winner") {
    return "f1_winner";
  }
  return Array.isArray(market?.sport_outcomes) ? "sport_outcome" : "binary";
}

export function enrichPositions(positions) {
  return (positions ?? []).map((position) => {
    const market = asMarket(position.markets);
    const prices = outcomePrices(market);
    const side = String(position.side ?? "");
    const currentPrice = Number.isFinite(prices[side]) ? prices[side] : null;
    const shares = finite(position.shares);
    const coinsStaked = finite(position.coins_staked);
    const currentValue = currentPrice === null ? null : shares * currentPrice;
    const entryPrice = shares > 0 ? coinsStaked / shares : null;
    const selected = outcomeMeta(market, side);
    return {
      ...position,
      markets: market,
      currentPrice,
      currentValue,
      entryPrice,
      unrealizedPnl: currentValue === null ? null : currentValue - coinsStaked,
      outcomeProbabilities: prices,
      sideLabel: selected.label,
      sideColor: selected.color,
      sideLogo: selected.logo,
      sideHeadshotUrl: selected.headshotUrl,
      sellKind: sellKind(market),
    };
  });
}

function transactionSide(transaction) {
  return String(transaction?.meta?.side ?? transaction?.meta?.outcome_key ?? "").trim();
}

export function buildSettledTrades(transactions, openMarketIds = new Set()) {
  const groups = new Map();
  for (const transaction of transactions ?? []) {
    if (!transaction.market_id || !["bet", "sell", "payout"].includes(transaction.type)) continue;
    const marketId = String(transaction.market_id);
    const group = groups.get(marketId) ?? {
      marketId,
      market: asMarket(transaction.markets),
      transactions: [],
    };
    if (!group.market) group.market = asMarket(transaction.markets);
    group.transactions.push(transaction);
    groups.set(marketId, group);
  }

  return [...groups.values()].flatMap((group) => {
    if (openMarketIds.has(group.marketId)) return [];
    const bets = group.transactions.filter((transaction) => transaction.type === "bet");
    if (bets.length === 0) return [];
    const market = group.market;
    const invested = Math.abs(bets.reduce((sum, transaction) => sum + finite(transaction.amount), 0));
    const returned = group.transactions
      .filter((transaction) => transaction.type === "sell" || transaction.type === "payout")
      .reduce((sum, transaction) => sum + Math.max(0, finite(transaction.amount)), 0);
    const pnl = returned - invested;
    const selectedKeys = [...new Set(bets.map(transactionSide).filter(Boolean))];
    const selected = selectedKeys.map((key) => ({ key, ...outcomeMeta(market, key) }));
    const latestTransactionAt = Math.max(...group.transactions.map((transaction) => Date.parse(transaction.created_at ?? "") || 0));
    const resolvedAt = Date.parse(market?.resolved_at ?? "") || 0;
    const concludedAt = Math.max(latestTransactionAt, resolvedAt);
    const officialKey = String(market?.outcome ?? "");
    const official = officialKey ? { key: officialKey, ...outcomeMeta(market, officialKey) } : null;
    return [{
      marketId: group.marketId,
      slug: String(market?.slug ?? ""),
      question: String(market?.question ?? "Treg i përfunduar"),
      category: String(market?.category ?? "te-tjera"),
      marketType: String(market?.market_type ?? "binary"),
      selected,
      official,
      invested,
      returned,
      pnl,
      result: pnl > 0.0001 ? "win" : pnl < -0.0001 ? "loss" : "flat",
      concludedAt,
      concludedAtIso: concludedAt ? new Date(concludedAt).toISOString() : null,
      resolution: market?.status === "resolved" ? "settled" : "sold",
    }];
  }).sort((a, b) => b.concludedAt - a.concludedAt);
}

export function buildRealizedBalanceHistory({ currentCoins, openStaked, settledTrades, now = new Date() }) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const windowStart = nowMs - 30 * DAY_MS;
  const currentRealizedBalance = finite(currentCoins) + finite(openStaked);
  const events = (settledTrades ?? [])
    .filter((trade) => trade.concludedAt >= windowStart && trade.concludedAt <= nowMs)
    .sort((a, b) => a.concludedAt - b.concludedAt);
  const pnl30d = events.reduce((sum, trade) => sum + finite(trade.pnl), 0);
  let running = currentRealizedBalance - pnl30d;
  const history = [{ t: windowStart, coins: running, pnl: 0, kind: "anchor" }];
  for (const trade of events) {
    running += finite(trade.pnl);
    history.push({
      t: trade.concludedAt,
      coins: running,
      pnl: finite(trade.pnl),
      kind: trade.result,
      slug: trade.slug,
      question: trade.question,
    });
  }
  history.push({ t: nowMs, coins: currentRealizedBalance, pnl: 0, kind: "current" });
  return { history, pnl30d, currentRealizedBalance };
}

export function buildPortfolioAnalytics({ profile, positions, transactions, now = new Date() }) {
  const enrichedPositions = enrichPositions(positions).filter((position) => position.markets?.status === "open" && finite(position.shares) > 0);
  const openMarketIds = new Set(enrichedPositions.map((position) => String(position.market_id)));
  const settledTrades = buildSettledTrades(transactions, openMarketIds);
  const openValue = enrichedPositions.reduce((sum, position) => sum + finite(position.currentValue), 0);
  const openStaked = enrichedPositions.reduce((sum, position) => sum + finite(position.coins_staked), 0);
  const openPnl = openValue - openStaked;
  const realizedPnl = settledTrades.reduce((sum, trade) => sum + trade.pnl, 0);
  const settledWins = settledTrades.filter((trade) => trade.result === "win").length;
  const currentCoins = finite(profile?.coins);
  const realized = buildRealizedBalanceHistory({
    currentCoins,
    openStaked,
    settledTrades,
    now,
  });
  return {
    positions: enrichedPositions,
    tradeHistory: settledTrades,
    balanceHistory: realized.history,
    stats: {
      coins: currentCoins,
      openValue,
      totalValue: currentCoins + openValue,
      openStaked,
      openPnl,
      realizedPnl,
      pnl30d: realized.pnl30d,
      realizedBalance: realized.currentRealizedBalance,
      winRate: settledTrades.length > 0 ? settledWins / settledTrades.length : null,
      settledCount: settledTrades.length,
    },
  };
}
