import { useState, useEffect, useCallback, useRef } from "react";
import {
  Banknote,
  CalendarDays,
  TrendingUp,
  Plus,
  Wallet,
  Edit2,
  Trash2,
  DollarSign,
  X,
  Loader2,
  CloudOff,
  CheckCircle2,
  AlertCircle,
  Download,
  RefreshCw,
  Calculator,
  Target,
  History,
  Clock,
  Award,
  TrendingDown,
  Zap,
  AlertTriangle,
  Calendar,
  Timer,
  Sparkles,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */

const API = {
  LIST: "/api/debts",
  ANALYTICS: "/api/debts/analytics",
  CREATE: "/api/debts",
  UPDATE: (id) => `/api/debts/${id}`,
  DELETE: (id) => `/api/debts/${id}`,
  ADD_PAYMENT: (id) => `/api/debts/${id}/payment`,
  EXPORT: "/api/debts/export/csv",
  UPCOMING: "/api/debts/upcoming",
  PAYOFF_CALC: (id) => `/api/debts/${id}/payoff-calculator`,
  STRATEGY: "/api/debts/strategy/recommendation",
  COUNTDOWN: "/api/debts/countdown",
  TOTAL_INTEREST: "/api/debts/total-interest",
  CALENDAR: "/api/debts/calendar",
  QUICK_IMPACT: "/api/debts/quick-impact",
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

const CATEGORY_COLOR = {
  "Car Loan": "#2563eb",
  "House Loan": "#7c3aed",
  "Education Loan (PTPTN)": "#10b981",
  BNPL: "#fb923c",
  "Credit Card": "#ef4444",
  "Personal Loan": "#6b7280",
  Other: "#64748b",
};

const CHART_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#10b981",
  "#fb923c",
  "#ef4444",
  "#6b7280",
  "#64748b",
  "#0ea5e9",
];

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

/* -------------------------------------------------------------------------- */
/*                                Main Component                              */
/* -------------------------------------------------------------------------- */

export default function DebtsPage() {
  const didHydrateRef = useRef(false);
  const toastTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

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

  const [debts, setDebts] = useState([]);
  const [analytics, setAnalytics] = useState({
    totals: {
      original: 0,
      remaining: 0,
      monthly: 0,
      paid: 0,
      progress: 0,
    },
    pieData: [],
    monthlyBreakdown: [],
  });

  const [upcomingPayments, setUpcomingPayments] = useState([]);
  const [strategy, setStrategy] = useState(null);
  const [countdown, setCountdown] = useState(null);
  const [totalInterest, setTotalInterest] = useState(null);
  const [calendar, setCalendar] = useState([]);
  const [quickImpact, setQuickImpact] = useState(null);

  const [filter, setFilter] = useState({
    category: "All",
  });

  /* ------------------------------ Modals ------------------------------ */

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showQuickImpactModal, setShowQuickImpactModal] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [paymentDebt, setPaymentDebt] = useState(null);
  const [calculatorDebt, setCalculatorDebt] = useState(null);
  const [historyDebt, setHistoryDebt] = useState(null);

  /* -------------------------------------------------------------------------- */
  /*                                  Loaders                                   */
  /* -------------------------------------------------------------------------- */

  async function loadDebts(signal) {
    const qs = new URLSearchParams();
    if (filter.category !== "All") qs.set("category", filter.category);

    const data = await apiFetch(`${API.LIST}?${qs.toString()}`, { signal });
    setDebts(data.debts || []);
  }

  async function loadAnalytics(signal) {
    const data = await apiFetch(API.ANALYTICS, { signal });
    setAnalytics(data);
  }

  async function loadUpcoming(signal) {
    try {
      const data = await apiFetch(API.UPCOMING, { signal });
      setUpcomingPayments(data.upcomingPayments || []);
    } catch (error) {
      console.error("Failed to load upcoming payments:", error);
    }
  }

  async function loadStrategy(signal) {
    try {
      const data = await apiFetch(API.STRATEGY, { signal });
      setStrategy(data);
    } catch (error) {
      console.error("Failed to load strategy:", error);
    }
  }

  async function loadCountdown(signal) {
    try {
      const data = await apiFetch(API.COUNTDOWN, { signal });
      setCountdown(data);
    } catch (error) {
      console.error("Failed to load countdown:", error);
    }
  }

  async function loadTotalInterest(signal) {
    try {
      const data = await apiFetch(API.TOTAL_INTEREST, { signal });
      setTotalInterest(data);
    } catch (error) {
      console.error("Failed to load total interest:", error);
    }
  }

  async function loadCalendar(signal) {
    try {
      const data = await apiFetch(API.CALENDAR, { signal });
      setCalendar(data.payments || []);
    } catch (error) {
      console.error("Failed to load calendar:", error);
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
        loadDebts(abortController.signal),
        loadAnalytics(abortController.signal),
        loadUpcoming(abortController.signal),
        loadStrategy(abortController.signal),
        loadCountdown(abortController.signal),
        loadTotalInterest(abortController.signal),
        loadCalendar(abortController.signal),
      ]);
      didHydrateRef.current = true;
      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      if (e.name === "AbortError") return;
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to load debts.",
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
          loadDebts(abortController.signal),
          loadAnalytics(abortController.signal),
          loadUpcoming(abortController.signal),
          loadStrategy(abortController.signal),
          loadCountdown(abortController.signal),
          loadTotalInterest(abortController.signal),
          loadCalendar(abortController.signal),
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
  }, [filter.category]);

  /* -------------------------------------------------------------------------- */
  /*                                CRUD Actions                                */
  /* -------------------------------------------------------------------------- */

  async function handleCreateDebt(formData) {
    setStatus((s) => ({ ...s, busy: true, error: "", offlineSaveError: false }));

    try {
      await apiFetch(API.CREATE, {
        method: "POST",
        body: JSON.stringify(formData),
      });

      showToast("Debt added successfully", "ok");
      setShowAddModal(false);
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(err?.message || "Failed to create debt", "warn");
    }
  }

  async function handleUpdateDebt(id, formData) {
    setStatus((s) => ({ ...s, busy: true, error: "", offlineSaveError: false }));

    try {
      await apiFetch(API.UPDATE(id), {
        method: "PUT",
        body: JSON.stringify(formData),
      });

      showToast("Debt updated successfully", "ok");
      setShowEditModal(false);
      setEditingDebt(null);
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(err?.message || "Failed to update debt", "warn");
    }
  }

  async function handleDeleteDebt(id) {
    if (!window.confirm("Are you sure you want to delete this debt?")) {
      return;
    }

    setStatus((s) => ({ ...s, busy: true, error: "", offlineSaveError: false }));

    try {
      await apiFetch(API.DELETE(id), { method: "DELETE" });
      showToast("Debt deleted successfully", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(err?.message || "Failed to delete debt", "warn");
    }
  }

  async function handleAddPayment(id, paymentData) {
    setStatus((s) => ({ ...s, busy: true, error: "", offlineSaveError: false }));

    try {
      await apiFetch(API.ADD_PAYMENT(id), {
        method: "POST",
        body: JSON.stringify(paymentData),
      });

      showToast("Payment recorded successfully", "ok");
      setShowPaymentModal(false);
      setPaymentDebt(null);
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(err?.message || "Failed to add payment", "warn");
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Export                                   */
  /* -------------------------------------------------------------------------- */

  async function handleExport() {
    try {
      setStatus((s) => ({ ...s, busy: true }));

      const qs = new URLSearchParams();
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
      let filename = `debts_${filter.category || "all"}.csv`;
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
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf4ff] to-[#e5edff] px-4 sm:px-6 md:px-10 lg:px-12 py-8 font-inter overflow-hidden">
      {/* HEADER */}
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-[#0b1222]">Debt Manager</h1>
          <p className="text-slate-600 text-sm sm:text-base mt-1">
            Track, optimize, and eliminate your debts with smart strategies.
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
            Export
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.02] transition"
            type="button"
            aria-label="Add new debt"
          >
            <Plus className="w-4 h-4" /> Add Debt
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
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]" role="alert" aria-live="polite">
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

      {/* NEW FEATURE WIDGETS */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* 1. DEBT-FREE COUNTDOWN */}
        {countdown && !countdown.debtFree && (
          <DebtFreeCountdownWidget countdown={countdown} />
        )}

        {/* 2. TOTAL INTEREST TRACKER */}
        {totalInterest && totalInterest.totalCost > 0 && (
          <TotalInterestWidget totalInterest={totalInterest} />
        )}
      </div>

      {/* 3. PAYMENT CALENDAR */}
      {calendar.length > 0 && (
        <section className="mb-8">
          <PaymentCalendarWidget
            payments={calendar}
            onQuickImpact={() => setShowQuickImpactModal(true)}
          />
        </section>
      )}

      {/* SUMMARY CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <SummaryCard
          label="Total Loan Amount"
          value={`RM ${analytics.totals.original.toLocaleString()}`}
          icon={<Banknote className="w-5 h-5 text-blue-500" />}
          color="text-blue-600"
        />
        <SummaryCard
          label="Remaining Balance"
          value={`RM ${analytics.totals.remaining.toLocaleString()}`}
          icon={<Wallet className="w-5 h-5 text-rose-500" />}
          color="text-rose-600"
        />
        <SummaryCard
          label="Monthly Commitments"
          value={`RM ${analytics.totals.monthly.toLocaleString()}`}
          icon={<CalendarDays className="w-5 h-5 text-green-600" />}
          color="text-green-600"
        />
        <SummaryCard
          label="Overall Progress"
          value={`${analytics.totals.progress}%`}
          icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
          color="text-indigo-600"
        />
      </section>

      {/* UPCOMING PAYMENTS */}
      {upcomingPayments.length > 0 && (
        <section className="mb-8">
          <UpcomingPaymentsWidget payments={upcomingPayments} />
        </section>
      )}

      {/* DEBT STRATEGY RECOMMENDATION */}
      {strategy && strategy.totalDebts > 0 && (
        <section className="mb-8">
          <DebtStrategyCard strategy={strategy} />
        </section>
      )}

      {/* FILTERS */}
      <section className="bg-white/80 backdrop-blur-lg p-4 rounded-2xl shadow-md border border-slate-200 mb-8">
        <div className="flex items-center gap-4">
          <label className="text-sm font-semibold text-slate-700">Filter by Category:</label>
          <select
            value={filter.category}
            onChange={(e) => setFilter({ category: e.target.value })}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200"
          >
            <option>All</option>
            <option>Car Loan</option>
            <option>House Loan</option>
            <option>Education Loan (PTPTN)</option>
            <option>BNPL</option>
            <option>Credit Card</option>
            <option>Personal Loan</option>
            <option>Other</option>
          </select>
        </div>
      </section>

      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-8 mb-10">
        <ChartCard title="Debt Distribution" type="pie" data={analytics.pieData} />
        <ChartCard
          title="Monthly Payments Breakdown"
          type="bar"
          data={analytics.monthlyBreakdown}
        />
      </div>

      {/* LOAN LIST */}
      <section className="mb-10">
        <h2 className="text-2xl font-semibold text-[#0b1222] mb-4">My Debts</h2>

        {status.loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : debts.length === 0 ? (
          <div className="bg-white/80 rounded-2xl p-12 text-center border border-slate-200">
            <Wallet className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-600 font-medium">No debts recorded</p>
            <p className="text-sm text-slate-500 mt-1">
              Click "Add Debt" to start tracking your loans
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
            {debts.map((debt) => (
              <LoanCard
                key={debt._id}
                debt={debt}
                onEdit={() => {
                  setEditingDebt(debt);
                  setShowEditModal(true);
                }}
                onDelete={() => handleDeleteDebt(debt._id)}
                onAddPayment={() => {
                  setPaymentDebt(debt);
                  setShowPaymentModal(true);
                }}
                onCalculator={() => {
                  setCalculatorDebt(debt);
                  setShowCalculatorModal(true);
                }}
                onHistory={() => {
                  setHistoryDebt(debt);
                  setShowHistoryModal(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* MODALS */}

      {/* Add Debt Modal */}
      {showAddModal && (
        <Modal title="Add New Debt" onClose={() => setShowAddModal(false)}>
          <DebtForm
            onCancel={() => setShowAddModal(false)}
            onSave={handleCreateDebt}
            busy={status.busy}
          />
        </Modal>
      )}

      {/* Edit Debt Modal */}
      {showEditModal && editingDebt && (
        <Modal title="Edit Debt" onClose={() => setShowEditModal(false)}>
          <DebtForm
            debt={editingDebt}
            onCancel={() => {
              setShowEditModal(false);
              setEditingDebt(null);
            }}
            onSave={(data) => handleUpdateDebt(editingDebt._id, data)}
            busy={status.busy}
            isEditing
          />
        </Modal>
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && paymentDebt && (
        <Modal title={`Add Payment - ${paymentDebt.type}`} onClose={() => setShowPaymentModal(false)}>
          <PaymentForm
            debt={paymentDebt}
            onCancel={() => {
              setShowPaymentModal(false);
              setPaymentDebt(null);
            }}
            onSave={(data) => handleAddPayment(paymentDebt._id, data)}
            busy={status.busy}
          />
        </Modal>
      )}

      {/* Payoff Calculator Modal */}
      {showCalculatorModal && calculatorDebt && (
        <Modal
          title={`Payoff Calculator - ${calculatorDebt.type}`}
          onClose={() => setShowCalculatorModal(false)}
          large
        >
          <PayoffCalculator
            debtId={calculatorDebt._id}
            onClose={() => {
              setShowCalculatorModal(false);
              setCalculatorDebt(null);
            }}
          />
        </Modal>
      )}

      {/* Payment History Modal */}
      {showHistoryModal && historyDebt && (
        <Modal
          title={`Payment History - ${historyDebt.type}`}
          onClose={() => setShowHistoryModal(false)}
        >
          <PaymentHistory debt={historyDebt} />
        </Modal>
      )}

      {/* 4. QUICK IMPACT CALCULATOR MODAL */}
      {showQuickImpactModal && (
        <Modal
          title="Quick Impact Calculator"
          onClose={() => setShowQuickImpactModal(false)}
          large
        >
          <QuickImpactCalculator
            onClose={() => setShowQuickImpactModal(false)}
            quickImpact={quickImpact}
            setQuickImpact={setQuickImpact}
          />
        </Modal>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                            New Feature Components                          */
/* -------------------------------------------------------------------------- */

const DebtFreeCountdownWidget = ({ countdown }) => {
  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-indigo-100 rounded-lg">
          <Timer className="w-5 h-5 text-indigo-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">🎯 Debt-Free Countdown</h3>
          <p className="text-sm text-slate-600">Keep pushing!</p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 border border-indigo-100 mb-4">
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-4xl font-bold text-indigo-600">
              {countdown.countdown.years}
            </p>
            <p className="text-xs text-slate-600 mt-1">Years</p>
          </div>
          <div className="text-4xl font-bold text-slate-300">:</div>
          <div className="text-center">
            <p className="text-4xl font-bold text-purple-600">
              {countdown.countdown.months}
            </p>
            <p className="text-xs text-slate-600 mt-1">Months</p>
          </div>
          <div className="text-4xl font-bold text-slate-300">:</div>
          <div className="text-center">
            <p className="text-4xl font-bold text-pink-600">
              {countdown.countdown.days}
            </p>
            <p className="text-xs text-slate-600 mt-1">Days</p>
          </div>
        </div>

        <div className="text-center pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-600">Target Date</p>
          <p className="text-lg font-semibold text-slate-900 mt-1">
            {new Date(countdown.targetDate).toLocaleDateString("en-MY", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Last debt cleared: {countdown.lastDebtCleared}
          </p>
        </div>
      </div>

      <p className="text-center text-sm font-semibold text-indigo-700">
        💪 Keep going! You're on track to financial freedom!
      </p>
    </div>
  );
};

const TotalInterestWidget = ({ totalInterest }) => {
  return (
    <div className="bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-rose-100 rounded-lg">
          <TrendingDown className="w-5 h-5 text-rose-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">💰 Total Interest Tracker</h3>
          <p className="text-sm text-slate-600">The real cost of debt</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl p-4 border border-rose-100 text-center">
          <p className="text-xs text-slate-600 mb-1">Paid ✅</p>
          <p className="text-xl font-bold text-emerald-600">
            RM {totalInterest.totalPaid.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-rose-100 text-center">
          <p className="text-xs text-slate-600 mb-1">Will Pay ⏳</p>
          <p className="text-xl font-bold text-rose-600">
            RM {totalInterest.totalWillPay.toLocaleString()}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-rose-100 text-center">
          <p className="text-xs text-slate-600 mb-1">Total Cost</p>
          <p className="text-xl font-bold text-slate-900">
            RM {totalInterest.totalCost.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl p-4 border border-rose-100">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-slate-700">Progress</p>
          <p className="text-sm font-bold text-rose-600">
            {totalInterest.progress}%
          </p>
        </div>
        <div className="w-full bg-slate-200 h-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-green-600 rounded-full transition-all duration-500"
            style={{ width: `${totalInterest.progress}%` }}
          />
        </div>
      </div>

      {totalInterest.breakdown && totalInterest.breakdown.length > 0 && (
        <div className="mt-4 bg-white rounded-xl p-4 border border-rose-100">
          <p className="text-sm font-semibold text-slate-900 mb-2">
            Interest Breakdown by Debt
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {totalInterest.breakdown.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-2 border-b border-slate-100 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-slate-700 font-medium truncate">{item.type}</p>
                  <p className="text-slate-500 text-xs">
                    {item.interestRate}% interest
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-slate-900 font-semibold">
                    RM {item.totalInterest.toLocaleString()}
                  </p>
                  <p className="text-slate-500">
                    Paid: RM {item.interestPaid.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const PaymentCalendarWidget = ({ payments, onQuickImpact }) => {
  // Group payments by month
  const groupedByMonth = payments.reduce((acc, payment) => {
    const monthKey = `${payment.year}-${String(payment.month).padStart(2, "0")}`;
    if (!acc[monthKey]) {
      acc[monthKey] = [];
    }
    acc[monthKey].push(payment);
    return acc;
  }, {});

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-100 rounded-lg">
            <Calendar className="w-5 h-5 text-sky-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">📅 Payment Calendar</h3>
            <p className="text-sm text-slate-600">Next 90 days</p>
          </div>
        </div>

        <button
          onClick={onQuickImpact}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition"
          type="button"
        >
          <Sparkles className="w-4 h-4" />
          Quick Impact
        </button>
      </div>

      <div className="space-y-4">
        {Object.entries(groupedByMonth).map(([monthKey, monthPayments]) => {
          const [year, month] = monthKey.split("-");
          const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString(
            "en-MY",
            { month: "long", year: "numeric" }
          );

          return (
            <div key={monthKey} className="bg-white rounded-xl p-4 border border-sky-100">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">{monthName}</h4>
              <div className="space-y-2">
                {monthPayments.map((payment, idx) => {
                  const isOverdue = payment.isOverdue;
                  const isUrgent = payment.daysUntil <= 3 && payment.daysUntil >= 0;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isOverdue
                          ? "bg-rose-50 border-rose-200"
                          : isUrgent
                            ? "bg-amber-50 border-amber-200"
                            : "bg-slate-50 border-slate-100"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {payment.debtType}
                        </p>
                        <p className="text-xs text-slate-600">{payment.lender}</p>
                      </div>

                      <div className="text-right ml-4">
                        <p className="text-sm font-bold text-slate-900">
                          RM {payment.amount.toLocaleString()}
                        </p>
                        <p
                          className={`text-xs font-semibold ${
                            isOverdue
                              ? "text-rose-700"
                              : isUrgent
                                ? "text-amber-700"
                                : "text-slate-600"
                          }`}
                        >
                          {isOverdue ? (
                            <>
                              <AlertTriangle className="w-3 h-3 inline mr-1" />
                              Overdue!
                            </>
                          ) : (
                            `Day ${payment.day}`
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const QuickImpactCalculator = ({ onClose, quickImpact, setQuickImpact }) => {
  const [extraAmount, setExtraAmount] = useState(500);
  const [loading, setLoading] = useState(false);

  const calculateImpact = async () => {
    if (extraAmount <= 0) {
      alert("Please enter a positive amount");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch(
        `${API.QUICK_IMPACT}?extraAmount=${extraAmount}`
      );
      setQuickImpact(data);
    } catch (error) {
      console.error("Failed to calculate impact:", error);
      alert("Failed to calculate impact");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border-2 border-emerald-200">
        <h4 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Zap className="w-5 h-5 text-emerald-600" />
          What if I pay extra this month?
        </h4>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-800 mb-2">
              Extra Payment Amount (RM)
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                step="50"
                min="0"
                value={extraAmount}
                onChange={(e) => setExtraAmount(parseFloat(e.target.value) || 0)}
                className="flex-1 px-4 py-3 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                onClick={calculateImpact}
                disabled={loading}
                className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                type="button"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <Calculator className="w-4 h-4" />
                    Calculate
                  </>
                )}
              </button>
            </div>

            {/* Quick amount buttons */}
            <div className="flex gap-2 mt-2">
              {[100, 250, 500, 1000].map((amount) => (
                <button
                  key={amount}
                  onClick={() => setExtraAmount(amount)}
                  className="px-3 py-1 text-xs bg-white border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 transition"
                  type="button"
                >
                  RM {amount}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {quickImpact && !quickImpact.message && (
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-5 border-2 border-blue-200">
            <h5 className="text-sm font-semibold text-slate-900 mb-3">
              💡 Impact Summary
            </h5>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs text-slate-600 mb-1">Interest Saved</p>
                <p className="text-2xl font-bold text-emerald-600">
                  RM {quickImpact.interestSaved.toLocaleString()}
                </p>
              </div>

              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs text-slate-600 mb-1">Time Saved</p>
                <p className="text-2xl font-bold text-indigo-600">
                  {quickImpact.monthsSaved} months
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  ({quickImpact.yearsSaved} years)
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-sm text-slate-700 mb-2">
                <span className="font-semibold">Applied to:</span>{" "}
                {quickImpact.appliedTo} (highest interest)
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">Current Interest</p>
                  <p className="font-semibold text-slate-900">
                    RM {quickImpact.currentTotalInterest.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-slate-600">New Interest</p>
                  <p className="font-semibold text-emerald-600">
                    RM {quickImpact.newTotalInterest.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <p className="text-sm text-emerald-800 font-semibold text-center">
              ⚡ Making an extra payment of RM {quickImpact.extraAmount.toLocaleString()}{" "}
              will save you RM {quickImpact.interestSaved.toLocaleString()} in
              interest and get you debt-free {quickImpact.monthsSaved} months earlier!
            </p>
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        className="w-full px-6 py-3 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 transition"
        type="button"
      >
        Close
      </button>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                            Existing Components                             */
/* -------------------------------------------------------------------------- */

const UpcomingPaymentsWidget = ({ payments }) => {
  if (payments.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-100 rounded-lg">
          <Clock className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Upcoming Payments</h3>
          <p className="text-sm text-slate-600">Next 30 days</p>
        </div>
      </div>

      <div className="space-y-3">
        {payments.slice(0, 5).map((payment, idx) => {
          const isOverdue = payment.daysUntil < 0;
          const isUrgent = payment.daysUntil <= 3 && payment.daysUntil >= 0;

          return (
            <div
              key={idx}
              className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                isOverdue
                  ? "bg-rose-50 border-rose-300"
                  : isUrgent
                    ? "bg-amber-50 border-amber-300"
                    : "bg-white border-slate-200"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 truncate">{payment.type}</p>
                <p className="text-sm text-slate-600">{payment.lender}</p>
              </div>

              <div className="text-right ml-4">
                <p className="font-bold text-slate-900">
                  RM {payment.amount.toLocaleString()}
                </p>
                <p
                  className={`text-xs font-semibold ${
                    isOverdue
                      ? "text-rose-700"
                      : isUrgent
                        ? "text-amber-700"
                        : "text-slate-600"
                  }`}
                >
                  {isOverdue ? (
                    <>
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      Overdue!
                    </>
                  ) : isUrgent ? (
                    <>
                      <Zap className="w-3 h-3 inline mr-1" />
                      Due in {payment.daysUntil} days
                    </>
                  ) : (
                    `In ${payment.daysUntil} days`
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DebtStrategyCard = ({ strategy }) => {
  const recommended = strategy.recommended === "snowball" ? strategy.snowball : strategy.avalanche;
  const alternative = strategy.recommended === "snowball" ? strategy.avalanche : strategy.snowball;

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-50 border-2 border-violet-200 rounded-2xl p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-violet-100 rounded-lg">
          <Target className="w-5 h-5 text-violet-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Smart Debt Strategy</h3>
          <p className="text-sm text-slate-600">Recommended payoff plan</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Recommended */}
        <div className="bg-white rounded-xl p-4 border-2 border-violet-300">
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-4 h-4 text-violet-600" />
            <p className="font-bold text-violet-700">RECOMMENDED</p>
          </div>
          <p className="font-semibold text-slate-900 mb-1">{recommended.method}</p>
          <p className="text-sm text-slate-600 mb-3">{recommended.description}</p>

          <div className="space-y-1">
            {recommended.order.slice(0, 3).map((debt, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm py-2 border-b border-slate-100 last:border-0"
              >
                <span className="text-slate-700">
                  {idx + 1}. {debt.type}
                </span>
                <span className="font-medium text-slate-900">
                  RM {debt.balance.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Alternative */}
        <div className="bg-white rounded-xl p-4 border border-slate-200">
          <p className="font-semibold text-slate-700 mb-1">{alternative.method}</p>
          <p className="text-xs text-slate-500">{alternative.description}</p>
        </div>
      </div>
    </div>
  );
};

const PayoffCalculator = ({ debtId, onClose }) => {
  const [scenarios, setScenarios] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch(API.PAYOFF_CALC(debtId));
        setScenarios(data);
      } catch (error) {
        console.error("Failed to load calculator:", error);
      } finally {
        setLoading(false);
      }
    })();
  }, [debtId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!scenarios) {
    return <p className="text-center py-8 text-slate-600">Failed to load calculator</p>;
  }

  return (
    <div className="space-y-6">
      {/* Current Balance */}
      <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-5 border-2 border-blue-200">
        <p className="text-sm text-slate-700 font-medium mb-1">Current Balance</p>
        <p className="text-3xl font-bold text-slate-900">
          RM {scenarios.currentBalance.toLocaleString()}
        </p>
      </div>

      {/* Scenarios */}
      <div className="space-y-4">
        <h4 className="font-bold text-slate-900 flex items-center gap-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          Payoff Scenarios
        </h4>

        {scenarios.scenarios.map((scenario, idx) => (
          <div
            key={idx}
            className={`p-5 rounded-xl border-2 ${
              idx === 0
                ? "bg-slate-50 border-slate-300"
                : "bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-300"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-bold text-slate-900">{scenario.label}</p>
                <p className="text-sm text-slate-600">
                  RM {scenario.monthlyPayment.toLocaleString()}/month
                </p>
              </div>
              {scenario.savings && (
                <div className="bg-white rounded-lg px-3 py-1 border border-emerald-200">
                  <p className="text-xs text-emerald-700 font-semibold">
                    Save RM {scenario.savings.toLocaleString()}
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600">Months to Payoff</p>
                <p className="font-bold text-slate-900">{scenario.monthsToPayoff}</p>
              </div>
              <div>
                <p className="text-slate-600">Debt-Free Date</p>
                <p className="font-bold text-slate-900">{scenario.debtFreeDate}</p>
              </div>
              <div>
                <p className="text-slate-600">Total Interest</p>
                <p className="font-bold text-rose-600">
                  RM {scenario.totalInterest.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-slate-600">Total Paid</p>
                <p className="font-bold text-slate-900">
                  RM {scenario.totalPaid.toLocaleString()}
                </p>
              </div>
            </div>

            {scenario.monthsSaved && (
              <div className="mt-3 pt-3 border-t border-emerald-200">
                <p className="text-sm text-emerald-700 font-semibold">
                  ⚡ Payoff {scenario.monthsSaved} months faster!
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onClose}
        className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-sky-600 text-white font-semibold rounded-lg hover:opacity-90 transition"
        type="button"
      >
        Close Calculator
      </button>
    </div>
  );
};

const PaymentHistory = ({ debt }) => {
  if (!debt.paymentHistory || debt.paymentHistory.length === 0) {
    return (
      <div className="text-center py-12">
        <History className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-600">No payment history yet</p>
        <p className="text-sm text-slate-500 mt-1">
          Payments will appear here once you record them
        </p>
      </div>
    );
  }

  const sortedHistory = [...debt.paymentHistory].sort(
    (a, b) => new Date(b.date) - new Date(a.date)
  );

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-5 border-2 border-emerald-200">
        <p className="text-sm text-slate-700 font-medium mb-2">Total Payments Made</p>
        <p className="text-3xl font-bold text-emerald-700 mb-1">
          {debt.paymentHistory.length}
        </p>
        <p className="text-sm text-slate-600">
          Total paid: RM{" "}
          {debt.paymentHistory
            .reduce((sum, p) => sum + p.amount, 0)
            .toLocaleString()}
        </p>
      </div>

      {/* Timeline */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {sortedHistory.map((payment, idx) => (
          <div
            key={payment._id || idx}
            className="flex items-start gap-4 p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 transition"
          >
            <div className="shrink-0 w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="font-bold text-slate-900">
                  RM {payment.amount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(payment.date).toLocaleDateString()}
                </p>
              </div>
              {payment.note && (
                <p className="text-sm text-slate-600">{payment.note}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, icon, color }) => (
  <div className="bg-white/90 backdrop-blur-lg border border-slate-200 rounded-2xl p-6 shadow-md hover:shadow-lg transition">
    <div className="flex justify-between items-center">
      <p className="text-slate-600 text-sm">{label}</p>
      {icon}
    </div>
    <h3 className={`text-2xl font-semibold mt-1 ${color}`}>{value}</h3>
  </div>
);

const ChartCard = ({ title, type, data }) => (
  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-md hover:shadow-lg transition">
    <h3 className="text-xl font-semibold text-[#0b1222] mb-4">{title}</h3>

    {!data || data.length === 0 ? (
      <div className="h-[280px] flex items-center justify-center text-slate-500">
        No data available
      </div>
    ) : (
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" outerRadius={90} label>
                {data.map((entry, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={CATEGORY_COLOR[entry.name] || CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `RM ${value.toLocaleString()}`} />
              <Legend />
            </PieChart>
          ) : (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="category" />
              <YAxis />
              <Tooltip formatter={(value) => `RM ${value.toLocaleString()}`} />
              <Bar dataKey="monthly">
                {data.map((entry, i) => (
                  <Cell
                    key={`cell-${i}`}
                    fill={
                      CATEGORY_COLOR[entry.category] ||
                      CHART_COLORS[i % CHART_COLORS.length]
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

const LoanCard = ({ debt, onEdit, onDelete, onAddPayment, onCalculator, onHistory }) => {
  const paidPercent =
    debt.originalAmount > 0
      ? (((debt.originalAmount - debt.currentBalance) / debt.originalAmount) * 100).toFixed(1)
      : 0;

  const color = CATEGORY_COLOR[debt.category] || "#64748b";
  const hasHistory = debt.paymentHistory && debt.paymentHistory.length > 0;

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-md hover:shadow-lg transition">
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-slate-900 truncate">{debt.type}</h3>
          <p className="text-slate-600 text-sm truncate">{debt.lender}</p>
        </div>
        <span
          className="text-xs px-3 py-1 rounded-full text-white shrink-0 ml-2"
          style={{ background: color }}
        >
          {debt.category}
        </span>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 text-sm mt-4 mb-4">
        <div>
          <p className="text-slate-500">Remaining</p>
          <p className="font-semibold text-slate-900">
            RM {debt.currentBalance.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Monthly</p>
          <p className="font-semibold text-slate-900">
            RM {debt.monthlyPayment.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Interest</p>
          <p className="font-semibold text-slate-900">{debt.interestRate}%</p>
        </div>
        <div>
          <p className="text-slate-500">Next Payment</p>
          <p className="font-semibold text-slate-900">
            {new Date(debt.nextPaymentDate).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <p className="text-slate-500 text-xs mb-1">Progress: {paidPercent}%</p>
        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${paidPercent}%`, background: color }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <button
          onClick={onAddPayment}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-1"
          type="button"
        >
          <DollarSign className="w-4 h-4" /> Pay
        </button>
        <button
          onClick={onCalculator}
          className="px-3 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-sky-600 text-white text-sm font-semibold hover:opacity-90 transition flex items-center justify-center gap-1"
          type="button"
        >
          <Calculator className="w-4 h-4" /> Calc
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {hasHistory && (
          <button
            onClick={onHistory}
            className="px-2 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition flex items-center justify-center gap-1"
            type="button"
          >
            <History className="w-3 h-3" /> History
          </button>
        )}
        <button
          onClick={onEdit}
          className={`px-2 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-1 ${
            hasHistory ? "" : "col-span-2"
          }`}
          type="button"
        >
          <Edit2 className="w-3 h-3" /> Edit
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-2 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 text-xs font-semibold hover:bg-rose-100 transition flex items-center justify-center gap-1"
          type="button"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const DebtForm = ({ debt, onCancel, onSave, busy, isEditing = false }) => {
  const [form, setForm] = useState({
    category: debt?.category || "Car Loan",
    type: debt?.type || "",
    lender: debt?.lender || "",
    originalAmount: debt?.originalAmount || "",
    currentBalance: debt?.currentBalance || "",
    monthlyPayment: debt?.monthlyPayment || "",
    interestRate: debt?.interestRate || "",
    interestRateType: "yearly", // NEW: "yearly" or "monthly"
    startDate: debt?.startDate ? new Date(debt.startDate).toISOString().split("T")[0] : "",
    endDate: debt?.endDate ? new Date(debt.endDate).toISOString().split("T")[0] : "",
    nextPaymentDate: debt?.nextPaymentDate
      ? new Date(debt.nextPaymentDate).toISOString().split("T")[0]
      : "",
    notes: debt?.notes || "",
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.type || !form.lender || !form.originalAmount) {
      alert("Please fill all required fields");
      return;
    }

    // Convert interest rate to yearly if user entered monthly
    let yearlyInterestRate = parseFloat(form.interestRate);
    if (form.interestRateType === "monthly") {
      yearlyInterestRate = yearlyInterestRate * 12;
    }

    onSave({
      category: form.category,
      type: form.type,
      lender: form.lender,
      originalAmount: parseFloat(form.originalAmount),
      currentBalance: parseFloat(form.currentBalance),
      monthlyPayment: parseFloat(form.monthlyPayment),
      interestRate: yearlyInterestRate, // Always save as yearly
      startDate: form.startDate,
      endDate: form.endDate,
      nextPaymentDate: form.nextPaymentDate,
      notes: form.notes,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">Category *</label>
        <select
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
          required
        >
          <option>Car Loan</option>
          <option>House Loan</option>
          <option>Education Loan (PTPTN)</option>
          <option>BNPL</option>
          <option>Credit Card</option>
          <option>Personal Loan</option>
          <option>Other</option>
        </select>
      </div>

      {/* Type */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">Loan Type *</label>
        <input
          type="text"
          placeholder="Eg: Myvi Loan / SPayLater / PTPTN"
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          value={form.type}
          onChange={(e) => update("type", e.target.value)}
          required
          maxLength={100}
        />
      </div>

      {/* Lender */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">Lender *</label>
        <input
          type="text"
          placeholder="Maybank, Shopee, PTPTN, etc."
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          value={form.lender}
          onChange={(e) => update("lender", e.target.value)}
          required
          maxLength={100}
        />
      </div>

      {/* Amount Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-800 text-sm font-semibold mb-1">
            Original Amount (RM) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={form.originalAmount}
            onChange={(e) => update("originalAmount", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-slate-800 text-sm font-semibold mb-1">
            Current Balance (RM) *
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={form.currentBalance}
            onChange={(e) => update("currentBalance", e.target.value)}
            required
          />
        </div>
      </div>

      {/* Monthly Payment */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">
          Monthly Payment (RM) *
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          value={form.monthlyPayment}
          onChange={(e) => update("monthlyPayment", e.target.value)}
          required
        />
      </div>

      {/* UPDATED: Interest Rate with Type Selector */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-2">
          Interest Rate *
        </label>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            step="0.01"
            min="0"
            max={form.interestRateType === "monthly" ? "10" : "100"}
            placeholder={form.interestRateType === "monthly" ? "e.g., 0.29" : "e.g., 3.5"}
            className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={form.interestRate}
            onChange={(e) => update("interestRate", e.target.value)}
            required
          />
          <select
            className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={form.interestRateType}
            onChange={(e) => update("interestRateType", e.target.value)}
          >
            <option value="yearly">% per year</option>
            <option value="monthly">% per month</option>
          </select>
        </div>

        {/* Helper text */}
        <p className="text-xs text-slate-500 mt-2">
          {form.interestRateType === "yearly" ? (
            <>
              💡 Example: If your loan is <strong>3.5% per year</strong>, enter{" "}
              <strong>3.5</strong>
            </>
          ) : (
            <>
              💡 Example: If your loan is <strong>0.29% per month</strong>, enter{" "}
              <strong>0.29</strong>
            </>
          )}
        </p>

        {/* Show conversion */}
        {form.interestRate && (
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-900 font-semibold">
              {form.interestRateType === "yearly" ? (
                <>
                  📊 Monthly rate: {(parseFloat(form.interestRate) / 12).toFixed(4)}%
                </>
              ) : (
                <>
                  📊 Yearly rate: {(parseFloat(form.interestRate) * 12).toFixed(2)}%
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-slate-800 text-sm font-semibold mb-1">Start Date *</label>
          <input
            type="date"
            className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={form.startDate}
            onChange={(e) => update("startDate", e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-slate-800 text-sm font-semibold mb-1">End Date *</label>
          <input
            type="date"
            className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            value={form.endDate}
            onChange={(e) => update("endDate", e.target.value)}
            required
          />
        </div>
      </div>

      {/* Next Payment */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">
          Next Payment Date *
        </label>
        <input
          type="date"
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          value={form.nextPaymentDate}
          onChange={(e) => update("nextPaymentDate", e.target.value)}
          required
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">
          Notes (optional)
        </label>
        <textarea
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
          rows={3}
          value={form.notes}
          onChange={(e) => update("notes", e.target.value)}
          maxLength={1000}
          placeholder="Additional notes..."
        />
      </div>

      {/* Buttons */}
      <div className="pt-4 flex justify-end gap-3">
        <button
          type="button"
          className="px-6 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 transition"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-sky-600 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>{isEditing ? "Update Debt" : "Save Debt"}</>
          )}
        </button>
      </div>
    </form>
  );
};

const PaymentForm = ({ debt, onCancel, onSave, busy }) => {
  const [form, setForm] = useState({
    amount: debt.monthlyPayment || "",
    date: new Date().toISOString().split("T")[0],
    note: "",
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!form.amount || parseFloat(form.amount) <= 0) {
      alert("Please enter a valid payment amount");
      return;
    }

    onSave({
      amount: parseFloat(form.amount),
      date: form.date,
      note: form.note,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-xl p-5 border-2 border-blue-200">
        <p className="text-sm text-slate-700 font-medium mb-1">Current Balance</p>
        <p className="text-3xl font-bold text-slate-900">
          RM {debt.currentBalance.toLocaleString()}
        </p>
      </div>

      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">
          Payment Amount (RM) *
        </label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
          value={form.amount}
          onChange={(e) => update("amount", e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">Payment Date *</label>
        <input
          type="date"
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
          value={form.date}
          onChange={(e) => update("date", e.target.value)}
          required
        />
      </div>

      <div>
        <label className="block text-slate-800 text-sm font-semibold mb-1">Note (optional)</label>
        <input
          type="text"
          placeholder="E.g., Monthly installment"
          className="w-full px-3 py-2.5 bg-white border-2 border-slate-300 rounded-lg text-slate-900 placeholder-slate-500 font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none"
          value={form.note}
          onChange={(e) => update("note", e.target.value)}
          maxLength={200}
        />
      </div>

      <div className="pt-4 flex justify-end gap-3">
        <button
          type="button"
          className="px-6 py-2.5 bg-slate-100 text-slate-800 font-semibold rounded-lg hover:bg-slate-200 transition"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-6 py-2.5 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-semibold rounded-lg hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {busy ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <DollarSign className="w-4 h-4" /> Record Payment
            </>
          )}
        </button>
      </div>
    </form>
  );
};

const Modal = ({ title, onClose, children, large = false }) => (
  <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
    <div
      className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
      onKeyDown={(e) => e.key === "Enter" && onClose()}
    />
    <div
      className={`relative w-full ${
        large ? "sm:max-w-4xl" : "sm:max-w-2xl"
      } bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[88vh] overflow-y-auto`}
    >
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-start justify-between gap-3 z-10">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-[#0b1222] truncate">{title}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition shrink-0"
          aria-label="Close modal"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);