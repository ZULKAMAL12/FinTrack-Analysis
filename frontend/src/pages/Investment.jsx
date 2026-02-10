// src/pages/Investment.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Download,
  Calendar,
  DollarSign,
  BarChart2,
  ArrowUpCircle,
  ArrowDownCircle,
  Bitcoin,
  LineChart as LineIcon,
  PieChart as PieIcon,
  Globe,
  Star,
  Pencil,
  Trash2,
  X,
  Loader2,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  Wallet,
  ShoppingCart,
  TrendingDown as SellIcon,
  Gift,
  Settings,
} from "lucide-react";

import {
  AreaChart,
  Area,
  PieChart as RePieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */
const API = {
  ASSETS: "/api/investments/assets",
  ASSET_BY_ID: (id) => `/api/investments/assets/${id}`,
  TRANSACTIONS: "/api/investments/transactions",
  TX_BY_ID: (id) => `/api/investments/transactions/${id}`,
  PRICES: "/api/investments/prices",
  PRICE_REFRESH: "/api/investments/prices/refresh",
  EXPORT_TX: "/api/investments/export/transactions",
  EXPORT_ASSETS: "/api/investments/export/assets",
};

async function apiFetch(path, options = {}) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error("Missing VITE_API_URL in frontend .env");

  const token = localStorage.getItem("token");

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    signal: options.signal,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Session expired. Please login again.");
  }

  if (options.expectBlob) {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Export failed");
    }
    return { blob: await res.blob(), res };
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* -------------------------------------------------------------------------- */
/*                               Helpers / Utils                              */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const ASSET_TYPES = [
  { value: "stock", label: "Stock" },
  { value: "etf", label: "ETF" },
  { value: "crypto", label: "Cryptocurrency" },
  { value: "gold", label: "Gold" },
];

const EXCHANGES = [
  { value: "US", label: "US Markets (NASDAQ/NYSE)" },
  { value: "KLSE", label: "Bursa Malaysia (.KL)" },
  { value: "CRYPTO", label: "Cryptocurrency" },
  { value: "COMMODITY", label: "Commodities" },
];

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatRM(n) {
  const v = safeNumber(n, 0);
  return `RM ${v.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatCurrency(n, currency = "USD") {
  const v = safeNumber(n, 0);
  const symbol = currency === "USD" ? "$" : currency === "MYR" ? "RM " : "";
  return `${symbol}${v.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function yyyymmToLabel(year, month) {
  const m = MONTHS.find((x) => x.value === month)?.label || String(month);
  return `${m} ${year}`;
}

function getNowYM() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function clampInt(n, min, max) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

function buildYearsList(startYear = 2020, yearsAhead = 1) {
  const now = new Date();
  const end = now.getFullYear() + yearsAhead;
  const out = [];
  for (let y = end; y >= startYear; y--) out.push(y);
  return out;
}

function isValidDecimal(value) {
  if (!value) return true;
  return /^\d*\.?\d{0,8}$/.test(value); // Allow up to 8 decimals for crypto
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function txTypeLabel(t) {
  if (t === "buy") return "Buy";
  if (t === "sell") return "Sell";
  if (t === "dividend") return "Dividend";
  return t || "Unknown";
}

/* -------------------------------------------------------------------------- */
/*                                  Main Page                                 */
/* -------------------------------------------------------------------------- */

export default function InvestmentPage() {
  const didHydrateRef = useRef(false);
  const toastTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [status, setStatus] = useState({
    loading: true,
    busy: false,
    refreshingPrices: false,
    error: "",
    offlineSaveError: false,
  });

  const nowYM = useMemo(() => getNowYM(), []);
  const [filter, setFilter] = useState({
    year: nowYM.year,
    month: nowYM.month,
    assetId: "all",
    viewMode: "month", // "month" | "year"
    assetType: "all", // "all" | "stock" | "crypto" | "gold"
  });

  const [assets, setAssets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [prices, setPrices] = useState({}); // { symbol: { price, currency, change24h, lastUpdated } }

  const [toast, setToast] = useState({ show: false, msg: "", tone: "info" });

  const showToast = useCallback((msg, tone = "info") => {
    setToast({ show: true, msg, tone });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, msg: "", tone: "info" });
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /* ------------------------------ Modals ------------------------------ */
  const [activeTab, setActiveTab] = useState("portfolio"); // "portfolio" | "market"

  const [addAssetModal, setAddAssetModal] = useState({
    open: false,
    name: "",
    symbol: "",
    type: "stock",
    exchange: "US",
    currency: "USD",
    error: "",
  });

  const [buyModal, setBuyModal] = useState({
    open: false,
    assetId: null,
    assetName: "",
    symbol: "",
    currency: "USD",
    year: nowYM.year,
    month: nowYM.month,
    day: "",
    units: "",
    pricePerUnit: "",
    totalCost: "",
    notes: "",
    error: "",
  });

  const [sellModal, setSellModal] = useState({
    open: false,
    assetId: null,
    assetName: "",
    symbol: "",
    currency: "USD",
    availableUnits: 0,
    year: nowYM.year,
    month: nowYM.month,
    day: "",
    units: "",
    pricePerUnit: "",
    totalProceeds: "",
    notes: "",
    error: "",
  });

  const [deleteAssetModal, setDeleteAssetModal] = useState({
    open: false,
    id: null,
    name: "",
    error: "",
  });

  const [exportModal, setExportModal] = useState({
    open: false,
    exportType: "transactions",
    year: nowYM.year,
    assetId: "all",
    error: "",
    busy: false,
  });

  /* -------------------------------------------------------------------------- */
  /*                                  Loaders                                   */
  /* -------------------------------------------------------------------------- */

  async function loadAssets(signal) {
    const res = await apiFetch(API.ASSETS, { signal });
    const list = Array.isArray(res.assets) ? res.assets : [];
    setAssets(list);
    return list;
  }

  async function loadTransactions(f, signal) {
    const qs = new URLSearchParams();
    qs.set("year", String(f.year));
    if (f.viewMode === "month" && f.month) qs.set("month", String(f.month));
    if (f.assetId && f.assetId !== "all") qs.set("assetId", String(f.assetId));

    const res = await apiFetch(`${API.TRANSACTIONS}?${qs.toString()}`, {
      signal,
    });
    const list = Array.isArray(res.transactions) ? res.transactions : [];
    setTransactions(list);
  }

  async function loadPrices(assetList, signal) {
    if (!assetList.length) return;

    const symbols = assetList.map((a) => ({
      symbol: a.symbol,
      type: a.type,
      exchange: a.exchange,
    }));

    try {
      const res = await apiFetch(API.PRICES, {
        method: "POST",
        body: JSON.stringify({ assets: symbols }),
        signal,
      });
      setPrices(res.prices || {});
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Failed to load prices:", e);
      }
    }
  }

  async function refreshPrices() {
    if (!assets.length) return;

    setStatus((s) => ({ ...s, refreshingPrices: true }));

    try {
      const symbols = assets.map((a) => ({
        symbol: a.symbol,
        type: a.type,
        exchange: a.exchange,
      }));

      const res = await apiFetch(API.PRICE_REFRESH, {
        method: "POST",
        body: JSON.stringify({ assets: symbols }),
      });

      setPrices(res.prices || {});
      showToast("Prices updated", "ok");
    } catch {
      showToast("Failed to refresh prices", "warn");
    } finally {
      setStatus((s) => ({ ...s, refreshingPrices: false }));
    }
  }

  async function loadAll() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus((s) => ({
      ...s,
      loading: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      const assetList = await loadAssets(abortController.signal);
      await loadTransactions(filter, abortController.signal);
      await loadPrices(assetList, abortController.signal);
      didHydrateRef.current = true;
      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      if (e.name === "AbortError") return;
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to load investments.",
      }));
    }
  }

  useEffect(() => {
    didHydrateRef.current = false;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!didHydrateRef.current) return;

    const abortController = new AbortController();

    (async () => {
      try {
        setStatus((s) => ({ ...s, loading: true, error: "" }));
        await loadTransactions(filter, abortController.signal);
        setStatus((s) => ({ ...s, loading: false }));
      } catch (e) {
        if (e.name !== "AbortError") {
          setStatus((s) => ({
            ...s,
            loading: false,
            error: e?.message || "Failed to load.",
          }));
        }
      }
    })();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.year, filter.month, filter.assetId, filter.viewMode]);

  /* -------------------------------------------------------------------------- */
  /*                               Derived Metrics                              */
  /* -------------------------------------------------------------------------- */

  const filteredAssets = useMemo(() => {
    if (filter.assetType === "all") return assets;
    return assets.filter((a) => a.type === filter.assetType);
  }, [assets, filter.assetType]);

  const portfolioMetrics = useMemo(() => {
    let totalInvested = 0;
    let totalCurrentValue = 0;
    let totalCurrentValueMYR = 0;

    for (const asset of filteredAssets) {
      const holding = asset.totalUnits || 0;
      if (holding <= 0) continue;

      const priceData = prices[asset.symbol];
      const currentPrice = priceData?.price || asset.lastKnownPrice || 0;
      const fxRate = priceData?.myrRate || 1;

      const marketValue = holding * currentPrice;
      const marketValueMYR = marketValue * fxRate;

      totalInvested += safeNumber(asset.totalInvested, 0);
      totalCurrentValue += marketValue;
      totalCurrentValueMYR += marketValueMYR;
    }

    const profit = totalCurrentValueMYR - totalInvested;
    const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrentValue,
      totalCurrentValueMYR,
      profit,
      roi,
    };
  }, [filteredAssets, prices]);

  const allocationData = useMemo(() => {
    return filteredAssets
      .map((a) => {
        const holding = a.totalUnits || 0;
        if (holding <= 0) return null;

        const priceData = prices[a.symbol];
        const currentPrice = priceData?.price || a.lastKnownPrice || 0;
        const fxRate = priceData?.myrRate || 1;
        const value = holding * currentPrice * fxRate;

        return {
          name: a.name || a.symbol,
          value,
          color: a.color || getColorForType(a.type),
        };
      })
      .filter((x) => x && x.value > 0);
  }, [filteredAssets, prices]);

  const projection6m = useMemo(() => {
    // Simple projection based on current portfolio
    const months = [];
    const now = new Date();
    let baseValue = portfolioMetrics.totalCurrentValueMYR;

    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleString("en", { month: "short" });

      // Simple 1% monthly growth estimate
      baseValue = baseValue * 1.01;

      months.push({
        month: label,
        value: Number(baseValue.toFixed(2)),
      });
    }

    return months;
  }, [portfolioMetrics.totalCurrentValueMYR]);

  /* -------------------------------------------------------------------------- */
  /*                                CRUD Actions                                */
  /* -------------------------------------------------------------------------- */

  function openAddAsset() {
    setAddAssetModal({
      open: true,
      name: "",
      symbol: "",
      type: "stock",
      exchange: "US",
      currency: "USD",
      error: "",
    });
  }

  async function createAsset(e) {
    e.preventDefault();

    const symbol = String(addAssetModal.symbol || "")
      .trim()
      .toUpperCase();
    if (!symbol) {
      return setAddAssetModal((m) => ({ ...m, error: "Symbol is required." }));
    }

    const name = String(addAssetModal.name || "").trim();
    if (!name) {
      return setAddAssetModal((m) => ({ ...m, error: "Name is required." }));
    }

    const payload = {
      name,
      symbol,
      type: addAssetModal.type,
      exchange: addAssetModal.exchange,
      currency: addAssetModal.currency,
    };

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(API.ASSETS, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAddAssetModal((m) => ({ ...m, open: false }));
      showToast("Asset added to portfolio", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setAddAssetModal((m) => ({
        ...m,
        error: e?.message || "Failed to add asset.",
      }));
    }
  }

  function openBuy(asset) {
    const priceData = prices[asset.symbol];
    const currentPrice = priceData?.price || asset.lastKnownPrice || 0;

    setBuyModal({
      open: true,
      assetId: asset._id,
      assetName: asset.name,
      symbol: asset.symbol,
      currency: asset.currency,
      year: filter.year || nowYM.year,
      month: filter.month || nowYM.month,
      day: "",
      units: "",
      pricePerUnit: currentPrice > 0 ? String(currentPrice) : "",
      totalCost: "",
      notes: "",
      error: "",
    });
  }

  async function saveBuy(e) {
    e.preventDefault();

    const units = safeNumber(buyModal.units, -1);
    const pricePerUnit = safeNumber(buyModal.pricePerUnit, -1);

    if (units <= 0 || pricePerUnit <= 0) {
      return setBuyModal((m) => ({
        ...m,
        error: "Units and price must be greater than 0.",
      }));
    }

    if (
      !isValidDecimal(buyModal.units) ||
      !isValidDecimal(buyModal.pricePerUnit)
    ) {
      return setBuyModal((m) => ({
        ...m,
        error: "Invalid number format.",
      }));
    }

    const year = clampInt(buyModal.year, 2000, 2100);
    const month = clampInt(buyModal.month, 1, 12);
    const day = buyModal.day ? clampInt(buyModal.day, 1, 31) : 1;

    const payload = {
      assetId: buyModal.assetId,
      type: "buy",
      units,
      pricePerUnit,
      totalAmount: units * pricePerUnit,
      year,
      month,
      day,
      notes: String(buyModal.notes || "")
        .trim()
        .substring(0, 500),
    };

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(API.TRANSACTIONS, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setBuyModal((m) => ({ ...m, open: false }));
      showToast("Buy order recorded", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setBuyModal((m) => ({
        ...m,
        error: err?.message || "Failed to record buy.",
      }));
    }
  }

  function openSell(asset) {
    const priceData = prices[asset.symbol];
    const currentPrice = priceData?.price || asset.lastKnownPrice || 0;
    const availableUnits = safeNumber(asset.totalUnits, 0);

    setSellModal({
      open: true,
      assetId: asset._id,
      assetName: asset.name,
      symbol: asset.symbol,
      currency: asset.currency,
      availableUnits,
      year: filter.year || nowYM.year,
      month: filter.month || nowYM.month,
      day: "",
      units: "",
      pricePerUnit: currentPrice > 0 ? String(currentPrice) : "",
      totalProceeds: "",
      notes: "",
      error: "",
    });
  }

  async function saveSell(e) {
    e.preventDefault();

    const units = safeNumber(sellModal.units, -1);
    const pricePerUnit = safeNumber(sellModal.pricePerUnit, -1);

    if (units <= 0 || pricePerUnit <= 0) {
      return setSellModal((m) => ({
        ...m,
        error: "Units and price must be greater than 0.",
      }));
    }

    if (units > sellModal.availableUnits) {
      return setSellModal((m) => ({
        ...m,
        error: `Cannot sell more than ${sellModal.availableUnits} units.`,
      }));
    }

    if (
      !isValidDecimal(sellModal.units) ||
      !isValidDecimal(sellModal.pricePerUnit)
    ) {
      return setSellModal((m) => ({
        ...m,
        error: "Invalid number format.",
      }));
    }

    const year = clampInt(sellModal.year, 2000, 2100);
    const month = clampInt(sellModal.month, 1, 12);
    const day = sellModal.day ? clampInt(sellModal.day, 1, 31) : 1;

    const payload = {
      assetId: sellModal.assetId,
      type: "sell",
      units,
      pricePerUnit,
      totalAmount: units * pricePerUnit,
      year,
      month,
      day,
      notes: String(sellModal.notes || "")
        .trim()
        .substring(0, 500),
    };

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(API.TRANSACTIONS, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSellModal((m) => ({ ...m, open: false }));
      showToast("Sell order recorded", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setSellModal((m) => ({
        ...m,
        error: err?.message || "Failed to record sell.",
      }));
    }
  }

  function openDeleteAsset(asset) {
    setDeleteAssetModal({
      open: true,
      id: asset._id,
      name: asset.name,
      error: "",
    });
  }

  async function confirmDeleteAsset() {
    if (!deleteAssetModal.id) return;

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(`${API.ASSET_BY_ID(deleteAssetModal.id)}`, {
        method: "DELETE",
      });
      setDeleteAssetModal({ open: false, id: null, name: "", error: "" });
      showToast("Asset removed from portfolio", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setDeleteAssetModal((m) => ({
        ...m,
        error: e?.message || "Delete failed.",
      }));
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Export                                   */
  /* -------------------------------------------------------------------------- */

  function openExport() {
    setExportModal({
      open: true,
      exportType: "transactions",
      year: filter.year,
      assetId: filter.assetId,
      error: "",
      busy: false,
    });
  }

  async function runExport(e) {
    e.preventDefault();
    setExportModal((m) => ({ ...m, busy: true, error: "" }));

    try {
      const year = clampInt(exportModal.year, 2000, 2100);
      const assetId = exportModal.assetId || "all";

      const qs = new URLSearchParams();
      if (exportModal.exportType !== "assets") qs.set("year", String(year));
      if (assetId !== "all") qs.set("assetId", assetId);

      let endpoint = API.EXPORT_TX;
      let filename = `investments_transactions_${year}.csv`;

      if (exportModal.exportType === "assets") {
        endpoint = API.EXPORT_ASSETS;
        filename = `investments_assets_summary.csv`;
        qs.delete("year");
      }

      const { blob, res } = await apiFetch(`${endpoint}?${qs.toString()}`, {
        expectBlob: true,
      });

      if (blob.size === 0) {
        setExportModal((m) => ({
          ...m,
          busy: false,
          error: "No data found for this selection.",
        }));
        return;
      }

      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) filename = match[1];

      downloadBlob(blob, filename);
      setExportModal((m) => ({ ...m, open: false, busy: false }));
      showToast("CSV download started", "ok");
    } catch (err) {
      setExportModal((m) => ({
        ...m,
        busy: false,
        error: err?.message || "Export failed.",
      }));
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */

  const years = useMemo(() => buildYearsList(2020, 1), []);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        if (addAssetModal.open)
          setAddAssetModal((m) => ({ ...m, open: false }));
        if (buyModal.open) setBuyModal((m) => ({ ...m, open: false }));
        if (sellModal.open) setSellModal((m) => ({ ...m, open: false }));
        if (deleteAssetModal.open)
          setDeleteAssetModal((m) => ({ ...m, open: false }));
        if (exportModal.open) setExportModal((m) => ({ ...m, open: false }));
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    addAssetModal.open,
    buyModal.open,
    sellModal.open,
    deleteAssetModal.open,
    exportModal.open,
  ]);

  // Auto-calculate total cost in buy modal
  useEffect(() => {
    if (buyModal.open) {
      const units = safeNumber(buyModal.units, 0);
      const price = safeNumber(buyModal.pricePerUnit, 0);
      const total = units * price;
      if (total > 0) {
        setBuyModal((m) => ({ ...m, totalCost: total.toFixed(2) }));
      }
    }
  }, [buyModal.units, buyModal.pricePerUnit, buyModal.open]);

  // Auto-calculate total proceeds in sell modal
  useEffect(() => {
    if (sellModal.open) {
      const units = safeNumber(sellModal.units, 0);
      const price = safeNumber(sellModal.pricePerUnit, 0);
      const total = units * price;
      if (total > 0) {
        setSellModal((m) => ({ ...m, totalProceeds: total.toFixed(2) }));
      }
    }
  }, [sellModal.units, sellModal.pricePerUnit, sellModal.open]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf4ff] to-[#e5edff] px-4 sm:px-6 md:px-10 lg:px-12 py-8 font-inter overflow-hidden">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0b1222]">
              Investment Portfolio
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1">
              Track stocks, crypto, and gold with real-time prices and net-worth
              integration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => loadAll()}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={status.busy || status.loading}
              aria-label="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 text-slate-700 ${status.loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              onClick={refreshPrices}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={status.refreshingPrices}
              aria-label="Refresh prices"
            >
              <TrendingUp
                className={`w-4 h-4 ${status.refreshingPrices ? "animate-pulse" : ""}`}
              />
              {status.refreshingPrices ? "Updating..." : "Update Prices"}
            </button>

            <button
              onClick={openExport}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
              type="button"
              aria-label="Export to CSV"
            >
              <Download className="w-4 h-4 text-slate-700" />
              Export CSV
            </button>

            <button
              onClick={openAddAsset}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.02] transition"
              type="button"
              aria-label="Add new asset"
            >
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white/85 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                View:
              </span>

              <Segment
                value={filter.viewMode}
                onChange={(v) =>
                  setFilter((f) => ({
                    ...f,
                    viewMode: v,
                    month: v === "year" ? 0 : f.month || getNowYM().month,
                  }))
                }
                options={[
                  { value: "month", label: "Month" },
                  { value: "year", label: "Year" },
                ]}
              />

              <select
                value={filter.year}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    year: clampInt(e.target.value, 2000, 2100),
                  }))
                }
                className={FILTER_SELECT}
                aria-label="Select year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {filter.viewMode === "month" && (
                <select
                  value={filter.month}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      month: clampInt(e.target.value, 1, 12),
                    }))
                  }
                  className={FILTER_SELECT}
                  aria-label="Select month"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}

              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

              <select
                value={filter.assetType}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, assetType: e.target.value }))
                }
                className={`${FILTER_SELECT} min-w-[140px]`}
                aria-label="Select asset type"
              >
                <option value="all">All types</option>
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>

              <select
                value={filter.assetId}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, assetId: e.target.value }))
                }
                className={`${FILTER_SELECT} min-w-[180px]`}
                aria-label="Select asset"
              >
                <option value="all">All assets</option>
                {assets.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.symbol} - {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1" />

            <div className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filter.viewMode === "month"
                  ? yyyymmToLabel(filter.year, filter.month || nowYM.month)
                  : `Year ${filter.year}`}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 bg-white/70 border border-slate-200 rounded-xl shadow-sm p-1">
          <button
            className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-medium transition ${
              activeTab === "portfolio"
                ? "bg-gradient-to-r from-blue-500 to-sky-600 text-white"
                : "text-slate-700 hover:text-blue-600"
            }`}
            onClick={() => setActiveTab("portfolio")}
          >
            My Portfolio
          </button>
          <button
            className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-medium transition ${
              activeTab === "market"
                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                : "text-slate-700 hover:text-emerald-600"
            }`}
            onClick={() => setActiveTab("market")}
          >
            Market Overview
          </button>
        </div>
      </header>

      {(status.error || status.offlineSaveError) && (
        <div
          className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 flex items-center gap-2"
          role="alert"
        >
          <CloudOff className="w-4 h-4" />
          {status.error || "Backend request failed. Check server + token."}
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]"
          role="alert"
          aria-live="polite"
        >
          <div
            className={`rounded-2xl px-4 py-3 shadow-lg border text-sm flex items-center gap-2 ${
              toast.tone === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : toast.tone === "warn"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-slate-50 border-slate-200 text-slate-800"
            }`}
          >
            {toast.tone === "ok" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.msg}
          </div>
        </div>
      )}

      {activeTab === "portfolio" ? (
        <>
          {/* Summary Cards */}
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <SummaryCard
              label="Total Invested"
              value={formatRM(portfolioMetrics.totalInvested)}
              color="text-blue-600"
              icon={<DollarSign className="w-5 h-5 text-blue-600" />}
            />
            <SummaryCard
              label="Current Value (MYR)"
              value={formatRM(portfolioMetrics.totalCurrentValueMYR)}
              color="text-emerald-600"
              icon={<BarChart2 className="w-5 h-5 text-emerald-600" />}
            />
            <SummaryCard
              label="Profit / Loss"
              value={formatRM(portfolioMetrics.profit)}
              color={
                portfolioMetrics.profit >= 0
                  ? "text-emerald-600"
                  : "text-red-600"
              }
              icon={
                portfolioMetrics.profit >= 0 ? (
                  <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-red-600" />
                )
              }
            />
            <SummaryCard
              label="ROI"
              value={`${portfolioMetrics.roi.toFixed(2)}%`}
              color="text-violet-600"
              icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
            />
          </section>

          {/* Charts */}
          <section className="grid lg:grid-cols-2 gap-6 sm:gap-8 mb-10">
            <ChartCard
              title="Portfolio Allocation"
              icon={<PieIcon className="w-5 h-5 text-indigo-600" />}
              data={allocationData}
              chartType="pie"
            />
            <ChartCard
              title="6-Month Projection"
              icon={<LineIcon className="w-5 h-5 text-sky-600" />}
              data={projection6m}
              chartType="line"
            />
          </section>

          {/* My Assets */}
          {status.loading ? (
            <div className="flex items-center gap-2 text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading portfolio...
            </div>
          ) : (
            <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8 mb-10">
              {filteredAssets.map((asset) => (
                <AssetCard
                  key={asset._id}
                  asset={asset}
                  priceData={prices[asset.symbol]}
                  busy={status.busy}
                  onBuy={() => openBuy(asset)}
                  onSell={() => openSell(asset)}
                  onDelete={() => openDeleteAsset(asset)}
                />
              ))}

              {filteredAssets.length === 0 && (
                <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
                  No assets in portfolio. Click <b>Add Asset</b> to get started.
                </div>
              )}
            </section>
          )}

          {/* Transaction History */}
          <section className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-[#0b1222] mb-4">
              Transaction History
            </h2>

            {transactions.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
                No transactions found for this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-600 border-b">
                      <th className="py-2 pr-4">#</th>
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Asset</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Units</th>
                      <th className="py-2 pr-4">Price/Unit</th>
                      <th className="py-2 pr-4">Total</th>
                      <th className="py-2 pr-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions
                      .slice()
                      .sort((a, b) => {
                        if (a.year !== b.year) return b.year - a.year;
                        if (a.month !== b.month) return b.month - a.month;
                        return (b.day || 1) - (a.day || 1);
                      })
                      .map((tx, idx) => (
                        <tr
                          key={tx._id || idx}
                          className="border-b last:border-b-0"
                        >
                          <td className="py-2 pr-4 text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {tx.day ? `${tx.day}/` : ""}
                            {tx.month}/{tx.year}
                          </td>
                          <td className="py-2 pr-4 font-medium text-slate-800">
                            {tx.assetSymbol || tx.assetName || "—"}
                          </td>
                          <td className="py-2 pr-4">
                            <span
                              className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${
                                tx.type === "buy"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : tx.type === "sell"
                                    ? "bg-rose-100 text-rose-700"
                                    : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {txTypeLabel(tx.type)}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {tx.units}
                          </td>
                          <td className="py-2 pr-4 text-slate-500">
                            {formatCurrency(tx.pricePerUnit, tx.currency)}
                          </td>
                          <td className="py-2 pr-4 font-medium text-slate-700">
                            {formatCurrency(tx.totalAmount, tx.currency)}
                          </td>
                          <td className="py-2 pr-4 text-slate-600">
                            {tx.notes || "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <>
          {/* Market Overview */}
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[#0b1222]">
              <Globe className="w-5 h-5 text-emerald-600" /> Market Overview
            </h2>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
              Market data will be available when you add assets to your
              portfolio. Click "Add Asset" to get started!
            </div>
          </div>
        </>
      )}

      {/* Modals */}

      {/* Add Asset Modal */}
      {addAssetModal.open && (
        <Modal
          title="Add Asset to Portfolio"
          onClose={() => setAddAssetModal((m) => ({ ...m, open: false }))}
        >
          {addAssetModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {addAssetModal.error}
            </div>
          )}

          <form onSubmit={createAsset} className="space-y-3">
            <Field label="Asset Type">
              <select
                value={addAssetModal.type}
                onChange={(e) =>
                  setAddAssetModal((m) => ({ ...m, type: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
                required
              >
                {ASSET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Symbol (Ticker)">
                <input
                  value={addAssetModal.symbol}
                  onChange={(e) =>
                    setAddAssetModal((m) => ({
                      ...m,
                      symbol: e.target.value.toUpperCase(),
                      error: "",
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="AAPL, BTC, MAYBANK.KL"
                  maxLength={20}
                  required
                  aria-required="true"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Use .KL suffix for Malaysian stocks
                </p>
              </Field>

              <Field label="Exchange">
                <select
                  value={addAssetModal.exchange}
                  onChange={(e) =>
                    setAddAssetModal((m) => ({
                      ...m,
                      exchange: e.target.value,
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                  required
                >
                  {EXCHANGES.map((ex) => (
                    <option key={ex.value} value={ex.value}>
                      {ex.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="Asset Name">
              <input
                value={addAssetModal.name}
                onChange={(e) =>
                  setAddAssetModal((m) => ({
                    ...m,
                    name: e.target.value,
                    error: "",
                  }))
                }
                className={`mt-1 ${SELECT_UI}`}
                placeholder="Apple Inc., Bitcoin, Maybank"
                maxLength={100}
                required
                aria-required="true"
              />
            </Field>

            <Field label="Currency">
              <select
                value={addAssetModal.currency}
                onChange={(e) =>
                  setAddAssetModal((m) => ({ ...m, currency: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
                required
              >
                <option value="USD">USD (US Dollar)</option>
                <option value="MYR">MYR (Malaysian Ringgit)</option>
              </select>
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              <b>Note:</b> After adding the asset, use "Buy" to record your
              first purchase.
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className="mt-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Asset
            </button>
          </form>
        </Modal>
      )}

      {/* Buy Modal */}
      {buyModal.open && (
        <Modal
          title={`Buy ${buyModal.assetName} (${buyModal.symbol})`}
          onClose={() => setBuyModal((m) => ({ ...m, open: false }))}
        >
          {buyModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {buyModal.error}
            </div>
          )}

          <form onSubmit={saveBuy} className="space-y-3">
            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-600 font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Purchase Date
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Field label="Year">
                  <select
                    value={buyModal.year}
                    onChange={(e) =>
                      setBuyModal((m) => ({
                        ...m,
                        year: clampInt(e.target.value, 2000, 2100),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    required
                  >
                    {years
                      .slice()
                      .reverse()
                      .map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Month">
                  <select
                    value={buyModal.month}
                    onChange={(e) =>
                      setBuyModal((m) => ({
                        ...m,
                        month: clampInt(e.target.value, 1, 12),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    required
                  >
                    {MONTHS.map((mm) => (
                      <option key={mm.value} value={mm.value}>
                        {mm.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Day">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={buyModal.day}
                    onChange={(e) =>
                      setBuyModal((m) => ({
                        ...m,
                        day: e.target.value,
                        error: "",
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    placeholder="1"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Units / Quantity">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.00000001"
                  min="0.00000001"
                  value={buyModal.units}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setBuyModal((m) => ({
                        ...m,
                        units: e.target.value,
                        error: "",
                      }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="1.0"
                  required
                  aria-required="true"
                />
              </Field>

              <Field label={`Price per Unit (${buyModal.currency})`}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={buyModal.pricePerUnit}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setBuyModal((m) => ({
                        ...m,
                        pricePerUnit: e.target.value,
                        error: "",
                      }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="150.00"
                  required
                  aria-required="true"
                />
              </Field>
            </div>

            {buyModal.totalCost && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-800">
                  <b>Total Cost:</b>{" "}
                  {formatCurrency(buyModal.totalCost, buyModal.currency)}
                </p>
              </div>
            )}

            <Field label="Notes (optional)">
              <input
                value={buyModal.notes}
                onChange={(e) =>
                  setBuyModal((m) => ({ ...m, notes: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
                placeholder="e.g., DCA strategy, bonus investment"
                maxLength={500}
              />
            </Field>

            <button
              type="submit"
              disabled={status.busy}
              className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShoppingCart className="w-4 h-4" />
              )}
              Record Buy
            </button>
          </form>
        </Modal>
      )}

      {/* Sell Modal */}
      {sellModal.open && (
        <Modal
          title={`Sell ${sellModal.assetName} (${sellModal.symbol})`}
          onClose={() => setSellModal((m) => ({ ...m, open: false }))}
        >
          {sellModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {sellModal.error}
            </div>
          )}

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-3">
            <p>
              <b>Available units:</b> {sellModal.availableUnits}
            </p>
          </div>

          <form onSubmit={saveSell} className="space-y-3">
            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-600 font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Sale Date
              </p>
              <div className="mt-2 grid grid-cols-3 gap-3">
                <Field label="Year">
                  <select
                    value={sellModal.year}
                    onChange={(e) =>
                      setSellModal((m) => ({
                        ...m,
                        year: clampInt(e.target.value, 2000, 2100),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    required
                  >
                    {years
                      .slice()
                      .reverse()
                      .map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Month">
                  <select
                    value={sellModal.month}
                    onChange={(e) =>
                      setSellModal((m) => ({
                        ...m,
                        month: clampInt(e.target.value, 1, 12),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    required
                  >
                    {MONTHS.map((mm) => (
                      <option key={mm.value} value={mm.value}>
                        {mm.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Day">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={sellModal.day}
                    onChange={(e) =>
                      setSellModal((m) => ({
                        ...m,
                        day: e.target.value,
                        error: "",
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    placeholder="1"
                  />
                </Field>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Units to Sell">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.00000001"
                  min="0.00000001"
                  max={sellModal.availableUnits}
                  value={sellModal.units}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setSellModal((m) => ({
                        ...m,
                        units: e.target.value,
                        error: "",
                      }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="1.0"
                  required
                  aria-required="true"
                />
              </Field>

              <Field label={`Price per Unit (${sellModal.currency})`}>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  value={sellModal.pricePerUnit}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setSellModal((m) => ({
                        ...m,
                        pricePerUnit: e.target.value,
                        error: "",
                      }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="200.00"
                  required
                  aria-required="true"
                />
              </Field>
            </div>

            {sellModal.totalProceeds && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-sm text-emerald-800">
                  <b>Total Proceeds:</b>{" "}
                  {formatCurrency(sellModal.totalProceeds, sellModal.currency)}
                </p>
              </div>
            )}

            <Field label="Notes (optional)">
              <input
                value={sellModal.notes}
                onChange={(e) =>
                  setSellModal((m) => ({ ...m, notes: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
                placeholder="e.g., Profit taking, rebalancing"
                maxLength={500}
              />
            </Field>

            <button
              type="submit"
              disabled={status.busy}
              className="mt-2 w-full py-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <SellIcon className="w-4 h-4" />
              )}
              Record Sell
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Asset Modal */}
      {deleteAssetModal.open && (
        <Modal
          title="Remove Asset from Portfolio"
          onClose={() =>
            setDeleteAssetModal({ open: false, id: null, name: "", error: "" })
          }
        >
          {deleteAssetModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {deleteAssetModal.error}
            </div>
          )}

          <p className="text-sm text-slate-700">
            Are you sure you want to remove <b>{deleteAssetModal.name}</b> from
            your portfolio?
            <br />
            This will also remove all related transactions.
          </p>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteAssetModal({
                  open: false,
                  id: null,
                  name: "",
                  error: "",
                })
              }
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteAsset}
              disabled={status.busy}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Remove
            </button>
          </div>
        </Modal>
      )}

      {/* Export Modal */}
      {exportModal.open && (
        <Modal
          title="Export Investment Data"
          onClose={() =>
            setExportModal((m) => ({
              ...m,
              open: false,
              error: "",
              busy: false,
            }))
          }
        >
          {exportModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {exportModal.error}
            </div>
          )}

          <form onSubmit={runExport} className="space-y-3">
            <Field label="Export Type">
              <select
                value={exportModal.exportType}
                onChange={(e) =>
                  setExportModal((m) => ({ ...m, exportType: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
              >
                <option value="transactions">Transaction History CSV</option>
                <option value="assets">Portfolio Summary CSV</option>
              </select>
            </Field>

            {exportModal.exportType !== "assets" && (
              <Field label="Year">
                <select
                  value={exportModal.year}
                  onChange={(e) =>
                    setExportModal((m) => ({
                      ...m,
                      year: clampInt(e.target.value, 2000, 2100),
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                >
                  {years
                    .slice()
                    .reverse()
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            <Field label="Asset (optional)">
              <select
                value={exportModal.assetId}
                onChange={(e) =>
                  setExportModal((m) => ({ ...m, assetId: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
              >
                <option value="all">All assets</option>
                {assets.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.symbol} - {a.name}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="submit"
              disabled={exportModal.busy}
              className="mt-2 bg-gradient-to-r from-slate-900 to-slate-700 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportModal.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download CSV
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Reusable UI Bits                              */
/* -------------------------------------------------------------------------- */

const SELECT_UI =
  "w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500";

const FILTER_SELECT =
  "px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500";

const SummaryCard = ({ label, value, color, icon }) => (
  <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
    <div className="flex justify-between items-center">
      <p className="text-gray-500 text-sm">{label}</p>
      {icon}
    </div>
    <h2 className={`text-xl sm:text-2xl font-semibold mt-1 ${color}`}>
      {value}
    </h2>
  </div>
);

const Segment = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
          value === o.value
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const ChartCard = ({ title, icon, data, chartType }) => (
  <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-md hover:shadow-lg transition">
    <h2 className="text-lg font-semibold text-[#0b1222] mb-4 flex items-center gap-2">
      {icon} {title}
    </h2>

    {data.length === 0 ? (
      <div className="h-[280px] flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
        No data available
      </div>
    ) : (
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <RePieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={100}
                paddingAngle={3}
                labelLine={false}
              >
                {data.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatRM(value)} />
              <Legend />
            </RePieChart>
          ) : (
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#94a3b8" />
              <Tooltip formatter={(v) => formatRM(v)} />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                fill="#0ea5e9"
                fillOpacity={0.15}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const AssetCard = ({ asset, priceData, busy, onBuy, onSell, onDelete }) => {
  const holding = safeNumber(asset.totalUnits, 0);
  const currentPrice = priceData?.price || asset.lastKnownPrice || 0;
  const change24h = priceData?.change24h || 0;
  const fxRate = priceData?.myrRate || 1;

  const marketValue = holding * currentPrice;
  const marketValueMYR = marketValue * fxRate;
  const totalInvested = safeNumber(asset.totalInvested, 0);
  const profitLoss = marketValueMYR - totalInvested;
  const roi = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

  const avgCost = holding > 0 ? totalInvested / holding : 0;

  const iconColor = getColorForType(asset.type);

  return (
    <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-md p-5 sm:p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-2 rounded-lg shrink-0"
            style={{ backgroundColor: `${iconColor}25` }}
          >
            {asset.type === "crypto" ? (
              <Bitcoin className="w-5 h-5" style={{ color: iconColor }} />
            ) : (
              <TrendingUp className="w-5 h-5" style={{ color: iconColor }} />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#0b1222] truncate">
              {asset.symbol}
            </h3>
            <p className="text-xs text-slate-500 truncate">{asset.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition"
            title="Remove asset"
            disabled={busy}
            aria-label="Remove asset"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      </div>

      {/* Current price */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 mb-3">
        <p className="text-[11px] text-slate-500">Current Price</p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-semibold text-slate-900">
            {formatCurrency(currentPrice, asset.currency)}
          </p>
          {asset.currency !== "MYR" && (
            <p className="text-sm text-slate-600">
              ≈ {formatRM(currentPrice * fxRate)}
            </p>
          )}
        </div>
        {change24h !== 0 && (
          <p
            className={`text-sm font-medium mt-1 ${change24h >= 0 ? "text-emerald-600" : "text-red-600"}`}
          >
            {change24h >= 0 ? "+" : ""}
            {change24h.toFixed(2)}% (24h)
          </p>
        )}
      </div>

      {/* Holdings */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">Holdings</p>
          <p className="text-sm font-semibold text-slate-900">
            {holding} units
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">Avg Cost</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatCurrency(avgCost, asset.currency)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">Market Value</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatRM(marketValueMYR)}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">P/L</p>
          <p
            className={`text-sm font-semibold ${profitLoss >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            {formatRM(profitLoss)}
            <span className="text-[10px] ml-1">
              ({roi >= 0 ? "+" : ""}
              {roi.toFixed(2)}%)
            </span>
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          type="button"
          onClick={onBuy}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Buy more"
        >
          <ShoppingCart className="w-4 h-4" /> Buy
        </button>

        <button
          type="button"
          onClick={onSell}
          disabled={busy || holding <= 0}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Sell"
        >
          <SellIcon className="w-4 h-4" /> Sell
        </button>
      </div>

      {priceData?.lastUpdated && (
        <p className="text-[10px] text-slate-400 mt-2 text-center">
          Price updated: {new Date(priceData.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    {children}
  </label>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
    <div
      className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    />
    <div className="relative w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[88vh] overflow-y-auto">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-[#0b1222] truncate">
            {title}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
          aria-label="Close modal"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

function getColorForType(type) {
  switch (type) {
    case "stock":
      return "#2563eb"; // blue
    case "etf":
      return "#16a34a"; // green
    case "crypto":
      return "#f59e0b"; // amber
    case "gold":
      return "#eab308"; // yellow
    default:
      return "#0ea5e9"; // sky
  }
}
