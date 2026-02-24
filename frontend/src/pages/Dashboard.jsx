import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Target,
  Banknote,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Info,
  CreditCard,
  Percent,
  Shield,
  Zap,
  Activity,
  DollarSign,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  LineChart,
  Line,
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

/* ----------------------------- helpers (API) ------------------------------ */
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
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) {
    const err = new Error(data.message || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data;
}

/* -------------------------- helpers (chart color) -------------------------- */
const PIE_COLORS = [
  "#0284c7",
  "#38bdf8",
  "#0ea5e9",
  "#7dd3fc",
  "#1d4ed8",
  "#2563eb",
  "#7c3aed",
  "#a78bfa",
];

function attachColors(items) {
  return (items || []).map((it, idx) => ({
    ...it,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));
}

function formatRM(amount) {
  return `RM ${Number(amount).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function Dashboard() {
  const nav = useNavigate();
  useEffect(() => window.scrollTo(0, 0), []);

  const today = new Date();
  const [period, setPeriod] = useState({
    year: today.getFullYear(),
    month: today.getMonth() + 1,
  });

  const [status, setStatus] = useState({ loading: true, error: "" });
  const [me, setMe] = useState(null);
  const [dashboard, setDashboard] = useState(null);

  async function load() {
    setStatus({ loading: true, error: "" });
    try {
      const [meRes, dashRes] = await Promise.all([
        apiFetch("/api/auth/me"),
        apiFetch(`/api/dashboard?year=${period.year}&month=${period.month}`),
      ]);

      setMe(meRes.user || null);
      setDashboard(dashRes);
      setStatus({ loading: false, error: "" });
    } catch (err) {
      if (err?.status === 401) {
        localStorage.removeItem("token");
        nav("/login");
        return;
      }
      setStatus({
        loading: false,
        error: err?.message || "Failed to load dashboard.",
      });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month]);

  /* -------------------------------------------------------------------------- */
  /*                               DERIVED DATA                                 */
  /* -------------------------------------------------------------------------- */

  const netWorth = dashboard?.netWorth?.total || 0;
  const totalAssets = dashboard?.netWorth?.assets || 0;
  const totalDebts = dashboard?.netWorth?.debts || 0;
  const cashBalance = dashboard?.netWorth?.breakdown?.cash || 0;
  const savingsBalance = dashboard?.netWorth?.breakdown?.savings || 0;
  const investmentsBalance = dashboard?.netWorth?.breakdown?.investments || 0;

  const monthlyIncome = dashboard?.totals?.income || 0;
  const monthlyExpenses = dashboard?.totals?.expense || 0;
  const monthlyCashflow = dashboard?.totals?.cashflow || 0;

  const savingsRate = dashboard?.ratios?.savingsRate || 0;
  const debtToIncome = dashboard?.ratios?.debtToIncome || 0;
  //const expenseToIncome = dashboard?.ratios?.expenseToIncome || 0;

  const totalBudget = dashboard?.budget?.total || 0;
  const budgetSpent = dashboard?.budget?.spent || 0;
  const budgetRemaining = dashboard?.budget?.remaining || 0;
  const budgetHealth = dashboard?.budget?.health || [];

  const savingsTotal = dashboard?.savings?.totalBalance || 0;
  const monthlyDeposits = dashboard?.savings?.monthlyDeposits || 0;
  const savingsROI = dashboard?.savings?.roi || 0;
  const savingsAccounts = dashboard?.savings?.accounts || [];

  const debtBalance = dashboard?.debts?.totalBalance || 0;
  const debtMonthlyPayment = dashboard?.debts?.monthlyPayment || 0;
  const debtInterestPaid = dashboard?.debts?.interestPaid || 0;
  const monthsToDebtFree = dashboard?.debts?.monthsToDebtFree || 0;
  const debtAccounts = dashboard?.debts?.accounts || [];

  const emergencyFund = dashboard?.emergencyFund?.amount || 0;
  const emergencyMonths = dashboard?.emergencyFund?.monthsCovered || 0;
  const emergencyTarget = dashboard?.emergencyFund?.target || 0;
  const emergencyProgress = dashboard?.emergencyFund?.progress || 0;

  const insights = dashboard?.insights || [];
  const expenseCategories = useMemo(
    () => attachColors(dashboard?.expenseByCategory || []),
    [dashboard]
  );

  // Income vs Expense chart (placeholder for multiple months)
  const incomeExpenseChart = useMemo(() => {
    const currentLabel = new Date(period.year, period.month - 1).toLocaleString(
      "en",
      { month: "short" }
    );
    return [
      { month: "Jan", income: 0, expenses: 0 },
      { month: "Feb", income: 0, expenses: 0 },
      { month: "Mar", income: 0, expenses: 0 },
      { month: "Apr", income: 0, expenses: 0 },
      { month: currentLabel, income: monthlyIncome, expenses: monthlyExpenses },
    ];
  }, [monthlyIncome, monthlyExpenses, period]);

  /* -------------------------------------------------------------------------- */
  /*                                  UI START                                  */
  /* -------------------------------------------------------------------------- */

  const monthName = new Date(period.year, period.month - 1).toLocaleString("en", {
    month: "long",
  });

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f7fbff] via-[#ecf2ff] to-[#dbe8ff] px-4 sm:px-6 md:px-10 lg:px-12 py-8 font-inter">
      {/* HEADER */}
      <header className="mb-8 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0b1222]">
              Financial Dashboard
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1">
              {me?.name ? `Hi, ${me.name} — ` : ""}Complete overview of your
              financial health
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={load}
              disabled={status.loading}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50"
              type="button"
            >
              <RefreshCw
                className={`w-4 h-4 ${status.loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <select
              value={period.month}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, month: Number(e.target.value) }))
              }
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2025, i, 1).toLocaleString("en", { month: "long" })}
                </option>
              ))}
            </select>

            <input
              type="number"
              value={period.year}
              onChange={(e) =>
                setPeriod((p) => ({
                  ...p,
                  year: Number(e.target.value || today.getFullYear()),
                }))
              }
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
              min={2000}
              max={2100}
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing data for <span className="font-semibold">{monthName} {period.year}</span>
        </div>
      </header>

      {/* STATUS BANNER */}
      {status.error && (
        <div className="mb-6 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl px-5 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          {status.error}
        </div>
      )}

      {/* INSIGHTS & ALERTS */}
      {!status.loading && insights.length > 0 && (
        <section className="mb-8">
          <InsightsWidget insights={insights} />
        </section>
      )}

      {/* KEY METRICS CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-5 mb-10">
        <MetricCard
          title="Net Worth"
          value={formatRM(netWorth)}
          icon={<Wallet className="w-5 h-5 text-sky-600" />}
          loading={status.loading}
          trend={netWorth > 0 ? "up" : netWorth < 0 ? "down" : "neutral"}
          subtitle="Assets - Debts"
        />
        <MetricCard
          title="Total Assets"
          value={formatRM(totalAssets)}
          icon={<ArrowUpCircle className="w-5 h-5 text-emerald-600" />}
          loading={status.loading}
          subtitle="Cash + Savings + Investments"
        />
        <MetricCard
          title="Total Debts"
          value={formatRM(totalDebts)}
          icon={<ArrowDownCircle className="w-5 h-5 text-rose-600" />}
          loading={status.loading}
          subtitle={debtBalance > 0 ? `${monthsToDebtFree} months to debt-free` : "Debt-free!"}
        />
        <MetricCard
          title="Cashflow (This Month)"
          value={formatRM(monthlyCashflow)}
          icon={<Activity className="w-5 h-5 text-indigo-600" />}
          loading={status.loading}
          trend={monthlyCashflow > 0 ? "up" : monthlyCashflow < 0 ? "down" : "neutral"}
          subtitle="Income - Expenses"
        />
        <MetricCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          loading={status.loading}
          subtitle={savingsRate >= 20 ? "Excellent!" : savingsRate >= 10 ? "Good" : "Improve"}
        />
        <MetricCard
          title="Debt-To-Income"
          value={`${debtToIncome.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5 text-amber-600" />}
          loading={status.loading}
          subtitle={debtToIncome < 30 ? "Healthy" : debtToIncome < 40 ? "Caution" : "High"}
        />
      </section>

      {/* BUDGET HEALTH & EMERGENCY FUND */}
      <section className="grid lg:grid-cols-3 gap-6 mb-10">
        {/* Budget Health */}
        <div className="lg:col-span-2">
          <BudgetHealthWidget
            totalBudget={totalBudget}
            budgetSpent={budgetSpent}
            budgetRemaining={budgetRemaining}
            budgetHealth={budgetHealth}
            loading={status.loading}
          />
        </div>

        {/* Emergency Fund */}
        <div>
          <EmergencyFundWidget
            amount={emergencyFund}
            monthsCovered={emergencyMonths}
            target={emergencyTarget}
            progress={emergencyProgress}
            loading={status.loading}
          />
        </div>
      </section>

      {/* INCOME/EXPENSE & EXPENSE BREAKDOWN */}
      <section className="grid lg:grid-cols-2 gap-6 mb-10">
        <ChartCard
          title="Income vs Expenses"
          subtitle={`${monthName} ${period.year}`}
          icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
          loading={status.loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpenseChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip formatter={(value) => formatRM(value)} />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" name="Income" />
              <Bar dataKey="expenses" fill="#f97316" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Expense Breakdown"
          subtitle="Top categories"
          icon={<PieIcon className="w-4 h-4 text-cyan-500" />}
          loading={status.loading}
        >
          {expenseCategories.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-slate-500">
              No expense data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={100}
                  label
                >
                  {expenseCategories.map((item, i) => (
                    <Cell key={i} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRM(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* SAVINGS & DEBTS SUMMARY */}
      <section className="grid lg:grid-cols-2 gap-6 mb-10">
        {/* Savings Summary */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <PiggyBank className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0b1222]">
                  Savings Overview
                </h3>
                <p className="text-xs text-slate-500">Total balance & ROI</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-emerald-700">
                {formatRM(savingsTotal)}
              </p>
              <p className="text-xs text-slate-500">
                ROI: {savingsROI.toFixed(2)}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">This Month Deposits</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatRM(monthlyDeposits)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Total Dividends</p>
              <p className="text-sm font-semibold text-emerald-700">
                {formatRM(dashboard?.savings?.totalDividends || 0)}
              </p>
            </div>
          </div>

          {status.loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : savingsAccounts.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">
              No savings accounts yet
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {savingsAccounts.map((acc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {acc.name}
                    </p>
                    {acc.goal > 0 && (
                      <p className="text-xs text-slate-500">
                        Goal: {acc.progress.toFixed(0)}%
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatRM(acc.balance)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Debts Summary */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-rose-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-[#0b1222]">
                  Debt Overview
                </h3>
                <p className="text-xs text-slate-500">
                  Outstanding & payments
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-rose-700">
                {formatRM(debtBalance)}
              </p>
              <p className="text-xs text-slate-500">
                {monthsToDebtFree > 0
                  ? `${monthsToDebtFree} months left`
                  : "Debt-free!"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Monthly Payment</p>
              <p className="text-sm font-semibold text-slate-900">
                {formatRM(debtMonthlyPayment)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-600">Interest Paid (Total)</p>
              <p className="text-sm font-semibold text-rose-700">
                {formatRM(debtInterestPaid)}
              </p>
            </div>
          </div>

          {status.loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 bg-slate-100 rounded-xl animate-pulse"
                />
              ))}
            </div>
          ) : debtAccounts.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4">
              🎉 No debts! You're debt-free!
            </div>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {debtAccounts.map((debt, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {debt.type} • {debt.lender}
                    </p>
                    <p className="text-xs text-slate-500">
                      {debt.interestRate.toFixed(2)}% p.a.
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {formatRM(debt.balance)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* NET WORTH BREAKDOWN */}
      <section className="mb-10">
        <NetWorthBreakdownWidget
          cash={cashBalance}
          savings={savingsBalance}
          investments={investmentsBalance}
          debts={totalDebts}
          netWorth={netWorth}
          loading={status.loading}
        />
      </section>

      <footer className="text-center text-xs text-slate-400 mt-10">
        FinTrack-Analysis • Comprehensive Dashboard • All modules integrated
      </footer>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                             REUSABLE COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const MetricCard = ({ title, value, icon, loading, trend, subtitle }) => (
  <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
    <div className="flex items-start justify-between mb-2">
      <div className="p-2 bg-sky-50 rounded-xl">{icon}</div>
      {trend && (
        <div
          className={`text-xs font-semibold ${
            trend === "up"
              ? "text-emerald-600"
              : trend === "down"
                ? "text-rose-600"
                : "text-slate-500"
          }`}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "•"}
        </div>
      )}
    </div>
    <p className="text-xs text-slate-500 mb-1">{title}</p>
    <h3 className="text-lg font-bold text-[#0b1222]">
      {loading ? (
        <span className="inline-block h-6 w-24 bg-slate-200 rounded animate-pulse" />
      ) : (
        value
      )}
    </h3>
    {subtitle && (
      <p className="text-[10px] text-slate-500 mt-1 truncate">{subtitle}</p>
    )}
  </div>
);

const ChartCard = ({ title, subtitle, icon, children, loading }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <div className="flex justify-between items-start mb-3">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-2 text-[#0b1222]">
          {icon} {title}
        </h2>
        {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
      </div>
    </div>
    <div className="h-[280px]">
      {loading ? (
        <div className="h-full w-full bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        children
      )}
    </div>
  </div>
);

const InsightsWidget = ({ insights }) => (
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6 shadow-md">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-amber-100 rounded-lg">
        <Zap className="w-5 h-5 text-amber-700" />
      </div>
      <div>
        <h3 className="text-lg font-bold text-slate-900">
          Financial Insights
        </h3>
        <p className="text-sm text-slate-600">
          {insights.length} insight{insights.length > 1 ? "s" : ""} for you
        </p>
      </div>
    </div>

    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
      {insights.map((insight, idx) => (
        <div
          key={idx}
          className={`rounded-xl border-2 p-4 ${
            insight.type === "warning"
              ? "bg-amber-50 border-amber-300"
              : insight.type === "alert"
                ? "bg-rose-50 border-rose-300"
                : insight.type === "success"
                  ? "bg-emerald-50 border-emerald-300"
                  : "bg-sky-50 border-sky-300"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {insight.type === "warning" ? (
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              ) : insight.type === "alert" ? (
                <AlertCircle className="w-5 h-5 text-rose-600" />
              ) : insight.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              ) : (
                <Info className="w-5 h-5 text-sky-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {insight.title}
              </p>
              <p className="text-xs text-slate-600 mt-1">{insight.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const BudgetHealthWidget = ({
  totalBudget,
  budgetSpent,
  budgetRemaining,
  budgetHealth,
  loading,
}) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <Target className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#0b1222]">
            Budget Health
          </h3>
          <p className="text-xs text-slate-500">Category performance</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-slate-900">
          {formatRM(budgetSpent)}
        </p>
        <p className="text-xs text-slate-500">
          of {formatRM(totalBudget)} budget
        </p>
        {/* ✅ NOW USING budgetRemaining */}
        <p className={`text-xs font-semibold mt-1 ${budgetRemaining >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {budgetRemaining >= 0 ? formatRM(budgetRemaining) : formatRM(Math.abs(budgetRemaining))} {budgetRemaining >= 0 ? 'remaining' : 'over'}
        </p>
      </div>
    </div>

    {loading ? (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    ) : budgetHealth.length === 0 ? (
      <div className="text-sm text-slate-500 text-center py-6">
        No budgets set for this period
      </div>
    ) : (
      <div className="space-y-3 max-h-[280px] overflow-y-auto">
        {budgetHealth.map((item, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {item.category}
                </p>
                <p className="text-xs text-slate-500">
                  {formatRM(item.spent)} / {formatRM(item.budget)}
                </p>
              </div>
              <div
                className={`px-2 py-1 rounded-lg text-xs font-semibold ${
                  item.status === "over"
                    ? "bg-rose-100 text-rose-700"
                    : item.status === "warning"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {item.percentage.toFixed(0)}%
              </div>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  item.status === "over"
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
    )}
  </div>
);

const EmergencyFundWidget = ({
  amount,
  monthsCovered,
  target,
  progress,
  loading,
}) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 h-full">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 bg-violet-50 rounded-lg">
        <Shield className="w-5 h-5 text-violet-600" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-[#0b1222]">
          Emergency Fund
        </h3>
        <p className="text-xs text-slate-500">Financial safety net</p>
      </div>
    </div>

    {loading ? (
      <div className="space-y-3">
        <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-8 bg-slate-100 rounded-xl animate-pulse" />
        <div className="h-4 bg-slate-100 rounded animate-pulse" />
      </div>
    ) : (
      <>
        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-violet-700">{formatRM(amount)}</p>
          <p className="text-sm text-slate-600 mt-1">
            Covers {monthsCovered.toFixed(1)} months
          </p>
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-600 mb-1">
            <span>Progress</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Target: {formatRM(target)} (6 months)
          </p>
        </div>

        <div
          className={`rounded-xl border-2 p-3 text-center ${
            monthsCovered >= 6
              ? "bg-emerald-50 border-emerald-300"
              : monthsCovered >= 3
                ? "bg-amber-50 border-amber-300"
                : "bg-rose-50 border-rose-300"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              monthsCovered >= 6
                ? "text-emerald-700"
                : monthsCovered >= 3
                  ? "text-amber-700"
                  : "text-rose-700"
            }`}
          >
            {monthsCovered >= 6
              ? "✅ Excellent!"
              : monthsCovered >= 3
                ? "⚠️ Good, but build more"
                : "🚨 Build emergency fund"}
          </p>
        </div>
      </>
    )}
  </div>
);

const NetWorthBreakdownWidget = ({
  cash,
  savings,
  investments,
  debts,
  netWorth,
  loading,
}) => {
  const data = [
    { name: "Cash/Bank", value: cash, color: "#0ea5e9" },
    { name: "Savings", value: savings, color: "#22c55e" },
    { name: "Investments", value: investments, color: "#7c3aed" },
    { name: "Debts", value: -debts, color: "#ef4444" },
  ].filter((item) => item.value !== 0);

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-sky-50 rounded-lg">
          <DollarSign className="w-5 h-5 text-sky-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#0b1222]">
            Net Worth Breakdown
          </h3>
          <p className="text-xs text-slate-500">Assets and liabilities</p>
        </div>
      </div>

      {loading ? (
        <div className="h-[200px] bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm font-medium text-slate-700">
                Cash/Bank
              </span>
              <span className="text-sm font-semibold text-slate-900">
                {formatRM(cash)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-emerald-50 p-3">
              <span className="text-sm font-medium text-emerald-700">
                Savings
              </span>
              <span className="text-sm font-semibold text-emerald-900">
                {formatRM(savings)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-violet-50 p-3">
              <span className="text-sm font-medium text-violet-700">
                Investments
              </span>
              <span className="text-sm font-semibold text-violet-900">
                {formatRM(investments)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-rose-50 p-3">
              <span className="text-sm font-medium text-rose-700">Debts</span>
              <span className="text-sm font-semibold text-rose-900">
                -{formatRM(debts)}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-slate-900 p-3">
              <span className="text-sm font-bold text-white">Net Worth</span>
              <span className="text-sm font-bold text-white">
                {formatRM(netWorth)}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={80}
                  label
                >
                  {data.map((item, i) => (
                    <Cell key={i} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRM(Math.abs(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};