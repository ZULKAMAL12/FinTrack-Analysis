import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  X,
  Loader2,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  DollarSign,
  CreditCard,
  Wallet,
  Smartphone,
  Building,
  BarChart3,
  PieChart as PieChartIcon,
  Calendar,
  Target,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */

const API = {
  LIST: "/api/expenses",
  SUMMARY: "/api/expenses/summary",
  CREATE: "/api/expenses",
  UPDATE: (id) => `/api/expenses/${id}`,
  DELETE: (id) => `/api/expenses/${id}`,
  EXPORT: "/api/expenses/export/csv",
  INSIGHTS: "/api/expenses/insights",
  TRENDS: "/api/expenses/trends",
  ALERTS: "/api/expenses/alerts",
};

async function apiFetch(path, options = {}) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error("Missing VITE_API_URL in frontend .env");

  const token = localStorage.getItem("token");

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
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
/*                                 Helpers                                    */
/* -------------------------------------------------------------------------- */

const COLORS = [
  "#0284c7",
  "#0ea5e9",
  "#38bdf8",
  "#7dd3fc",
  "#0369a1",
  "#0c4a6e",
  "#06b6d4",
  "#22d3ee",
];

const PAYMENT_METHOD_ICONS = {
  Cash: DollarSign,
  "Credit Card": CreditCard,
  "Debit Card": CreditCard,
  "E-wallet": Smartphone,
  "Bank Transfer": Building,
  Other: Wallet,
};

const PAYMENT_METHOD_COLORS = {
  Cash: "#10b981",
  "Credit Card": "#ef4444",
  "Debit Card": "#3b82f6",
  "E-wallet": "#8b5cf6",
  "Bank Transfer": "#f59e0b",
  Other: "#6b7280",
};

function getNowYM() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatYYYYMM(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function parseYYYYMM(str) {
  const [year, month] = str.split("-").map(Number);
  return { year, month };
}

function buildYearsList(startYear = 2020, yearsAhead = 1) {
  const now = new Date();
  const end = now.getFullYear() + yearsAhead;
  const out = [];
  for (let y = end; y >= startYear; y--) out.push(y);
  return out;
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

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

export default function Expenses() {
  const didHydrateRef = useRef(false);
  const toastTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const nowYM = getNowYM();

  const [status, setStatus] = useState({
    loading: true,
    busy: false,
    error: "",
    offlineSaveError: false,
  });

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

  /* ------------------------------ State ------------------------------ */

  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({
    current: { income: 0, expense: 0, balance: 0 },
    lastMonth: { income: 0, expense: 0, balance: 0 },
    categoryBreakdown: [],
  });
  const [insights, setInsights] = useState(null);
  const [trends, setTrends] = useState([]);
  const [alerts, setAlerts] = useState([]);

  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  /* ------------------------------ Filters ------------------------------ */

  const [filter, setFilter] = useState({
    yearMonth: formatYYYYMM(nowYM.year, nowYM.month),
    type: "All",
    category: "All",
    search: "",
  });

  const { year, month } = parseYYYYMM(filter.yearMonth);

  /* ------------------------------ Form ------------------------------ */

  const [form, setForm] = useState({
    type: "Expense",
    category: "",
    amount: "",
    note: "",
    paymentMethod: "Cash",
    year: nowYM.year,
    month: nowYM.month,
    day: new Date().getDate(),
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  /* ------------------------------ Categories ------------------------------ */

  const [categories] = useState([
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Healthcare",
    "Education",
    "Freelance",
    "Salary",
    "Investment",
    "Other",
  ]);

  const years = buildYearsList(2020, 1);

  /* -------------------------------------------------------------------------- */
  /*                                  Loaders                                   */
  /* -------------------------------------------------------------------------- */

  async function loadExpenses(signal) {
    const qs = new URLSearchParams();
    qs.set("year", String(year));
    qs.set("month", String(month));
    qs.set("page", String(pagination.page));
    qs.set("limit", String(pagination.limit));

    if (filter.type !== "All") qs.set("type", filter.type);
    if (filter.category !== "All") qs.set("category", filter.category);
    if (filter.search) qs.set("search", filter.search);

    const data = await apiFetch(`${API.LIST}?${qs.toString()}`, { signal });
    setExpenses(data.expenses || []);
    setPagination(data.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 });
  }

  async function loadSummary(signal) {
    const qs = new URLSearchParams();
    qs.set("year", String(year));
    qs.set("month", String(month));

    const data = await apiFetch(`${API.SUMMARY}?${qs.toString()}`, { signal });
    setSummary(data);
  }

  async function loadInsights(signal) {
    try {
      const qs = new URLSearchParams();
      qs.set("year", String(year));
      qs.set("month", String(month));

      const data = await apiFetch(`${API.INSIGHTS}?${qs.toString()}`, { signal });
      setInsights(data);
    } catch (error) {
      console.error("Failed to load insights:", error);
    }
  }

  async function loadTrends(signal) {
    try {
      const qs = new URLSearchParams();
      qs.set("year", String(year));
      qs.set("month", String(month));

      const data = await apiFetch(`${API.TRENDS}?${qs.toString()}`, { signal });
      setTrends(data.trends || []);
    } catch (error) {
      console.error("Failed to load trends:", error);
    }
  }

  async function loadAlerts(signal) {
    try {
      const qs = new URLSearchParams();
      qs.set("year", String(year));
      qs.set("month", String(month));

      const data = await apiFetch(`${API.ALERTS}?${qs.toString()}`, { signal });
      setAlerts(data.alerts || []);
    } catch (error) {
      console.error("Failed to load alerts:", error);
    }
  }

  async function loadAll() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus((s) => ({ ...s, loading: true, error: "", offlineSaveError: false }));

    try {
      await Promise.all([
        loadExpenses(abortController.signal),
        loadSummary(abortController.signal),
        loadInsights(abortController.signal),
        loadTrends(abortController.signal),
        loadAlerts(abortController.signal),
      ]);
      didHydrateRef.current = true;
      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      if (e.name === "AbortError") return;
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to load expenses.",
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
        await Promise.all([
          loadExpenses(abortController.signal),
          loadSummary(abortController.signal),
          loadInsights(abortController.signal),
          loadTrends(abortController.signal),
          loadAlerts(abortController.signal),
        ]);
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
  }, [filter.yearMonth, filter.type, filter.category, filter.search, pagination.page]);

  /* -------------------------------------------------------------------------- */
  /*                                CRUD Actions                                */
  /* -------------------------------------------------------------------------- */

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.amount || !form.category) {
      return showToast("Please fill all required fields", "warn");
    }

    setStatus((s) => ({ ...s, busy: true, error: "", offlineSaveError: false }));

    try {
      const payload = {
        type: form.type,
        category: form.category,
        amount: parseFloat(form.amount),
        note: form.note,
        paymentMethod: form.paymentMethod,
        year: form.year,
        month: form.month,
        day: form.day,
      };

      if (isEditing) {
        await apiFetch(API.UPDATE(editingId), {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        showToast("Transaction updated", "ok");
        setIsEditing(false);
        setEditingId(null);
      } else {
        await apiFetch(API.CREATE, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        showToast("Transaction added", "ok");
      }

      setForm({
        type: "Expense",
        category: "",
        amount: "",
        note: "",
        paymentMethod: "Cash",
        year: nowYM.year,
        month: nowYM.month,
        day: new Date().getDate(),
      });

      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(err?.message || "Failed to save transaction", "warn");
    }
  }

  function handleEdit(expense) {
    setForm({
      type: expense.type,
      category: expense.category,
      amount: expense.amount,
      note: expense.note || "",
      paymentMethod: expense.paymentMethod || "Cash",
      year: expense.year,
      month: expense.month,
      day: expense.day,
    });
    setEditingId(expense._id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setIsEditing(false);
    setEditingId(null);
    setForm({
      type: "Expense",
      category: "",
      amount: "",
      note: "",
      paymentMethod: "Cash",
      year: nowYM.year,
      month: nowYM.month,
      day: new Date().getDate(),
    });
  }

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    setStatus((s) => ({ ...s, busy: true, error: "", offlineSaveError: false }));

    try {
      await apiFetch(API.DELETE(id), { method: "DELETE" });
      showToast("Transaction deleted", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(err?.message || "Failed to delete", "warn");
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Export                                   */
  /* -------------------------------------------------------------------------- */

  async function handleExport() {
    try {
      setStatus((s) => ({ ...s, busy: true }));

      const qs = new URLSearchParams();
      qs.set("year", String(year));
      qs.set("month", String(month));
      if (filter.type !== "All") qs.set("type", filter.type);
      if (filter.category !== "All") qs.set("category", filter.category);

      const { blob, res } = await apiFetch(`${API.EXPORT}?${qs.toString()}`, {
        expectBlob: true,
      });

      if (blob.size === 0) {
        showToast("No data to export", "warn");
        setStatus((s) => ({ ...s, busy: false }));
        return;
      }

      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      let filename = `expenses_${year}_${month}.csv`;
      if (match?.[1]) filename = match[1];

      downloadBlob(blob, filename);
      showToast("CSV downloaded", "ok");
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false }));
      showToast(err?.message || "Export failed", "warn");
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-[#ecf2ff] to-[#dde9ff] px-4 sm:px-6 md:px-10 lg:px-12 py-8 font-inter">
      {/* HEADER */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0b1222]">
            Expense & Income Tracker
          </h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1">
            Track, analyze, and optimize your spending with budget insights.
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
            onClick={handleExport}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
            type="button"
            aria-label="Export to CSV"
          >
            <Download className="w-4 h-4 text-slate-700" />
            Export CSV
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

      {/* BUDGET ALERTS */}
      {alerts.length > 0 && (
        <section className="mb-8">
          <BudgetAlertsWidget alerts={alerts} />
        </section>
      )}

      {/* SPENDING INSIGHTS */}
      {insights && (
        <section className="mb-8">
          <SpendingInsightsWidget insights={insights} />
        </section>
      )}

      {/* THIS MONTH VS LAST MONTH */}
      <section className="mb-8 bg-white/90 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200">
        <h2 className="text-lg font-semibold text-[#0b1222] mb-4">
          This Month vs Last Month
        </h2>

        <div className="grid sm:grid-cols-3 gap-6">
          <StatComparison
            title="Income"
            current={summary.current.income}
            last={summary.lastMonth.income}
            color="emerald"
          />
          <StatComparison
            title="Expenses"
            current={summary.current.expense}
            last={summary.lastMonth.expense}
            color="red"
          />
          <StatComparison
            title="Net Balance"
            current={summary.current.balance}
            last={summary.lastMonth.balance}
            color="sky"
          />
        </div>
      </section>

      {/* SUMMARY CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <SummaryCard label="Total Income" value={summary.current.income} color="emerald" />
        <SummaryCard label="Total Expense" value={summary.current.expense} color="red" />
        <SummaryCard label="Net Balance" value={summary.current.balance} color="sky" />
      </section>

      {/* FILTERS */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200 mb-8">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4">Filters</h2>

        <div className="grid md:grid-cols-4 gap-4">
          <select
            value={filter.type}
            onChange={(e) => {
              setFilter((f) => ({ ...f, type: e.target.value }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="p-3 bg-white border border-slate-300 rounded-lg text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option>All</option>
            <option>Expense</option>
            <option>Income</option>
          </select>

          <select
            value={filter.category}
            onChange={(e) => {
              setFilter((f) => ({ ...f, category: e.target.value }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="p-3 bg-white border border-slate-300 rounded-lg text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option>All</option>
            {categories.map((c, i) => (
              <option key={i}>{c}</option>
            ))}
          </select>

          <input
            type="month"
            value={filter.yearMonth}
            onChange={(e) => {
              setFilter((f) => ({ ...f, yearMonth: e.target.value }));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="p-3 bg-white border border-slate-300 rounded-lg text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
          />

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search note or category"
              value={filter.search}
              onChange={(e) => {
                setFilter((f) => ({ ...f, search: e.target.value }));
                setPagination((p) => ({ ...p, page: 1 }));
              }}
              className="pl-10 p-3 bg-white border border-slate-300 rounded-lg text-[#0b1222] placeholder-slate-400 w-full focus:outline-none focus:ring-2 focus:ring-sky-200"
            />
          </div>
        </div>
      </section>

      {/* ADD / EDIT FORM */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200 mb-8">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4 flex items-center gap-2">
          {isEditing ? (
            <>
              <Edit2 className="w-5 h-5 text-blue-500" /> Edit Transaction
            </>
          ) : (
            <>
              <Plus className="w-5 h-5 text-sky-500" /> Add Transaction
            </>
          )}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-6 gap-4">
            {/* TYPE */}
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option>Expense</option>
              <option>Income</option>
            </select>

            {/* CATEGORY */}
            <input
              type="text"
              placeholder="Category*"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              list="categories-list"
              className="p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              required
            />
            <datalist id="categories-list">
              {categories.map((c, i) => (
                <option key={i} value={c} />
              ))}
            </datalist>

            {/* AMOUNT */}
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Amount*"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              required
            />

            {/* PAYMENT METHOD */}
            <select
              value={form.paymentMethod}
              onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}
              className="p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
            >
              <option>Cash</option>
              <option>Credit Card</option>
              <option>Debit Card</option>
              <option>E-wallet</option>
              <option>Bank Transfer</option>
              <option>Other</option>
            </select>

            {/* NOTE */}
            <input
              type="text"
              placeholder="Note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-200"
              maxLength={500}
            />

            {/* DATE */}
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Day"
                value={form.day}
                onChange={(e) => setForm({ ...form, day: parseInt(e.target.value) || 1 })}
                min="1"
                max="31"
                className="w-20 p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
              <select
                value={form.month}
                onChange={(e) => setForm({ ...form, month: parseInt(e.target.value) })}
                className="flex-1 p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) })}
                className="w-24 p-3 border border-slate-300 rounded-lg bg-white text-[#0b1222] focus:outline-none focus:ring-2 focus:ring-sky-200"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={status.busy}
              className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isEditing ? (
                <>
                  <Edit2 className="w-4 h-4" /> Update
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" /> Add Record
                </>
              )}
            </button>

            {isEditing && (
              <button
                type="button"
                onClick={cancelEdit}
                className="px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>
      </section>

      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        {/* Pie Chart */}
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200">
          <h2 className="font-semibold text-lg text-[#0b1222] mb-4 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-blue-600" />
            Expense Breakdown
          </h2>

          {summary.categoryBreakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={summary.categoryBreakdown}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {summary.categoryBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => `RM ${value.toFixed(2)}`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-12">
              <p className="text-slate-500">No expenses recorded for this month.</p>
            </div>
          )}
        </section>

        {/* Payment Method Chart */}
        {insights && insights.paymentMethodBreakdown && (
          <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200">
            <h2 className="font-semibold text-lg text-[#0b1222] mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-blue-600" />
              Payment Methods
            </h2>

            <div className="space-y-3">
              {Object.entries(insights.paymentMethodBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([method, amount]) => {
                  const Icon = PAYMENT_METHOD_ICONS[method] || Wallet;
                  const color = PAYMENT_METHOD_COLORS[method] || "#6b7280";
                  const total = Object.values(insights.paymentMethodBreakdown).reduce(
                    (sum, val) => sum + val,
                    0
                  );
                  const percentage = total > 0 ? (amount / total) * 100 : 0;

                  return (
                    <div key={method} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4" style={{ color }} />
                          <span className="text-slate-700 font-medium">{method}</span>
                        </div>
                        <span className="text-slate-900 font-semibold">
                          RM {amount.toFixed(2)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${percentage}%`,
                            backgroundColor: color,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        )}
      </div>

      {/* CATEGORY TRENDS */}
      {trends.length > 0 && (
        <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200 mb-8">
          <h2 className="font-semibold text-lg text-[#0b1222] mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Spending Trends (Last 6 Months)
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trends}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => `RM ${value.toFixed(2)}`} />
              <Legend />
              <Line
                type="monotone"
                dataKey="total"
                stroke="#0ea5e9"
                strokeWidth={2}
                name="Total Spending"
              />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* TRANSACTION TABLE */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4">Transaction History</h2>

        {status.loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-600">No transactions found for this filter.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b-2 border-slate-200">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Type</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">Payment</th>
                    <th className="pb-3 pr-4">Note</th>
                    <th className="pb-3 pr-4 text-right">Amount</th>
                    <th className="pb-3 pr-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((t) => {
                    const Icon = PAYMENT_METHOD_ICONS[t.paymentMethod] || Wallet;
                    const color = PAYMENT_METHOD_COLORS[t.paymentMethod] || "#6b7280";

                    return (
                      <tr key={t._id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 pr-4 text-slate-700">
                          {t.year}-{String(t.month).padStart(2, "0")}-
                          {String(t.day).padStart(2, "0")}
                        </td>
                        <td className="py-3 pr-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                              t.type === "Expense"
                                ? "bg-rose-100 text-rose-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {t.type}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-slate-700">{t.category}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-1">
                            <Icon className="w-3 h-3" style={{ color }} />
                            <span className="text-xs text-slate-600">{t.paymentMethod}</span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-600">{t.note || "—"}</td>
                        <td
                          className={`py-3 pr-4 text-right font-semibold ${
                            t.type === "Expense" ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {t.type === "Expense" ? "-" : "+"}RM {t.amount.toFixed(2)}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(t)}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(t._id)}
                              className="p-2 rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION */}
            <div className="flex justify-center items-center mt-6 gap-4">
              <button
                disabled={pagination.page === 1}
                onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                type="button"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <span className="text-sm font-medium text-slate-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                disabled={pagination.page === pagination.totalPages}
                onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                type="button"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Feature Components                              */
/* -------------------------------------------------------------------------- */

const BudgetAlertsWidget = ({ alerts }) => {
  const highSeverity = alerts.filter((a) => a.severity === "high");
  const mediumSeverity = alerts.filter((a) => a.severity === "medium");

  if (alerts.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-rose-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-rose-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Budget Alerts</h3>
          <p className="text-sm text-slate-600">
            {highSeverity.length > 0 && `${highSeverity.length} exceeded`}
            {highSeverity.length > 0 && mediumSeverity.length > 0 && ", "}
            {mediumSeverity.length > 0 && `${mediumSeverity.length} warnings`}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.slice(0, 5).map((alert, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-xl border-2 ${
              alert.severity === "high"
                ? "bg-rose-50 border-rose-300"
                : alert.severity === "medium"
                  ? "bg-amber-50 border-amber-300"
                  : "bg-blue-50 border-blue-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900">{alert.message}</p>
                {alert.category && (
                  <p className="text-sm text-slate-600 mt-1">Category: {alert.category}</p>
                )}
                {alert.spent !== undefined && alert.limit !== undefined && (
                  <p className="text-xs text-slate-600 mt-1">
                    Spent: RM {alert.spent.toFixed(2)} / RM {alert.limit.toFixed(2)}
                  </p>
                )}
              </div>

              {alert.percentage !== undefined && (
                <div
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold ${
                    alert.severity === "high"
                      ? "bg-rose-600 text-white"
                      : alert.severity === "medium"
                        ? "bg-amber-600 text-white"
                        : "bg-blue-600 text-white"
                  }`}
                >
                  {alert.percentage}%
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SpendingInsightsWidget = ({ insights }) => {
  if (!insights || !insights.summary) return null;

  const { summary, topCategories, budgetComparison } = insights;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-sky-50 border-2 border-blue-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-100 rounded-lg">
          <Target className="w-5 h-5 text-blue-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Spending Insights</h3>
          <p className="text-sm text-slate-600">Budget vs Actual Analysis</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-slate-600 mb-1">Total Spent</p>
          <p className="text-xl font-bold text-slate-900">
            RM {summary.totalSpent.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <p className="text-xs text-slate-600 mb-1">Daily Average</p>
          <p className="text-xl font-bold text-slate-900">
            RM {summary.dailyAverage.toFixed(2)}
          </p>
        </div>

        {summary.totalBudget > 0 && (
          <>
            <div className="bg-white rounded-xl p-4 border border-blue-100">
              <p className="text-xs text-slate-600 mb-1">Budget Remaining</p>
              <p
                className={`text-xl font-bold ${
                  summary.overBudget ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                RM {summary.budgetRemaining.toFixed(2)}
              </p>
            </div>

            <div className="bg-white rounded-xl p-4 border border-blue-100">
              <p className="text-xs text-slate-600 mb-1">Projected Monthly</p>
              <p className="text-xl font-bold text-slate-900">
                RM {summary.projectedMonthly.toFixed(2)}
              </p>
              {summary.projectedMonthly > summary.totalBudget && (
                <p className="text-xs text-rose-600 mt-1 font-semibold">
                  ⚠️ Over budget
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Top Categories */}
      {topCategories && topCategories.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-blue-100 mb-4">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Top Spending Categories</h4>
          <div className="space-y-2">
            {topCategories.slice(0, 3).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  {idx + 1}. {cat.category}
                </span>
                <span className="font-semibold text-slate-900">
                  RM {cat.total.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Comparison */}
      {budgetComparison && budgetComparison.length > 0 && (
        <div className="bg-white rounded-xl p-4 border border-blue-100">
          <h4 className="text-sm font-semibold text-slate-900 mb-3">Budget vs Actual</h4>
          <div className="space-y-3">
            {budgetComparison.slice(0, 5).map((item, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-700 font-medium">{item.category}</span>
                  <span className="text-slate-900 font-semibold">
                    RM {item.spent.toFixed(2)} / RM {item.limit.toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      item.status === "exceeded"
                        ? "bg-rose-500"
                        : item.status === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                    }`}
                    style={{ width: `${Math.min(item.percentage, 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                               Components                                   */
/* -------------------------------------------------------------------------- */

const SummaryCard = ({ label, value, color }) => (
  <div className="bg-white/90 backdrop-blur-lg p-6 rounded-2xl shadow-md border border-slate-200">
    <p className="text-slate-600 text-sm">{label}</p>
    <h3
      className={`text-2xl font-semibold mt-1 ${
        color === "emerald"
          ? "text-emerald-600"
          : color === "red"
            ? "text-red-600"
            : "text-sky-600"
      }`}
    >
      RM {value.toFixed(2)}
    </h3>
  </div>
);

const StatComparison = ({ title, current, last, color }) => {
  const diff = current - last;
  const isPositive = diff >= 0;

  return (
    <div className="p-5 bg-slate-50 rounded-xl border border-slate-200">
      <p className="text-slate-600 text-sm mb-1">{title}</p>
      <h3
        className={`text-2xl font-bold ${
          color === "emerald"
            ? "text-emerald-600"
            : color === "red"
              ? "text-red-600"
              : "text-sky-600"
        }`}
      >
        RM {current.toFixed(2)}
      </h3>
      <p className="text-xs text-slate-500 mt-2">Last Month: RM {last.toFixed(2)}</p>
      <div className="flex items-center gap-1 mt-1">
        {isPositive ? (
          <TrendingUp className="w-4 h-4 text-emerald-600" />
        ) : (
          <TrendingDown className="w-4 h-4 text-red-600" />
        )}
        <p
          className={`text-sm font-semibold ${
            isPositive ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {isPositive ? "+" : ""}
          {diff.toFixed(2)}
        </p>
      </div>
    </div>
  );
};