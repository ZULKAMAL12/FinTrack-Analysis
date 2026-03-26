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
  RefreshCw,
  Calendar,
  Award,
  Briefcase,
  Clock,
  ChevronUp,
  ChevronDown,
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
  AreaChart,
  Area,
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

/* -------------------------- helpers (colors/format) ------------------------ */
const PIE_COLORS = [
  "#0284c7", "#f59e0b", "#10b981", "#8b5cf6",
  "#ef4444", "#06b6d4", "#f97316", "#ec4899",
  "#14b8a6", "#6366f1",
];

function attachColors(items) {
  return (items || []).map((it, idx) => ({
    ...it,
    color: it.color || PIE_COLORS[idx % PIE_COLORS.length],
  }));
}

function formatRM(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "RM 0.00";
  const sign = num < 0 ? "-" : "";
  return `${sign}RM ${Math.abs(num).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function getScoreColor(score) {
  if (score >= 80) return { text: "text-emerald-700", label: "Excellent" };
  if (score >= 60) return { text: "text-blue-700", label: "Good" };
  if (score >= 40) return { text: "text-amber-700", label: "Fair" };
  return { text: "text-rose-700", label: "Needs Work" };
}

/* ========================================================================== */
/*                            MAIN DASHBOARD                                  */
/* ========================================================================== */

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

  const d = useMemo(() => dashboard || {}, [dashboard]);

  // Core metrics
  const netWorth = d.netWorth?.total || 0;
  const totalAssets = d.netWorth?.assets || 0;
  const totalDebts = d.netWorth?.debts || 0;
  const cashBalance = d.netWorth?.breakdown?.cash || 0;
  const savingsBalance = d.netWorth?.breakdown?.savings || 0;
  const investmentsBalance = d.netWorth?.breakdown?.investments || 0;

  const monthlyCashflow = d.totals?.cashflow || 0;

  const savingsRate = d.ratios?.savingsRate || 0;
  const debtToIncome = d.ratios?.debtToIncome || 0;

  // Budget
  const totalBudget = d.budget?.total || 0;
  const budgetSpent = d.budget?.spent || 0;
  const budgetRemaining = d.budget?.remaining || 0;
  const budgetHealth = d.budget?.health || [];
  const budgetSections = d.budget?.sections || [];

  // Savings
  const savingsTotal = d.savings?.totalBalance || 0;
  const monthlyDeposits = d.savings?.monthlyDeposits || 0;
  const monthlyDividendsSavings = d.savings?.monthlyDividends || 0;
  const savingsROI = d.savings?.roi || 0;
  const savingsAccounts = d.savings?.accounts || [];

  // Debts
  const debtBalance = d.debts?.totalBalance || 0;
  const debtOriginal = d.debts?.totalOriginal || 0;
  const debtMonthlyPayment = d.debts?.monthlyPayment || 0;
  const debtInterestPaid = d.debts?.interestPaid || 0;
  const monthsToDebtFree = d.debts?.monthsToDebtFree || 0;
  const debtProgress = d.debts?.debtProgress || 0;
  const debtAccounts = d.debts?.accounts || [];
  const upcomingPayments = d.debts?.upcomingPayments || [];

  // ✅ Investments — MYR values from live prices
  const investTotalInvestedMYR = d.investments?.totalInvestedMYR || 0;
  const investCurrentValueMYR = d.investments?.currentValueMYR || 0;
  const investTotalPL_MYR = d.investments?.totalPL_MYR || 0;
  const investROI = d.investments?.roi || 0;
  const investAssetCount = d.investments?.assetCount || 0;
  const investTopPerformers = d.investments?.topPerformers || [];
  const investMonthlyBuys = d.investments?.monthlyBuys || 0;
  const investMonthlySells = d.investments?.monthlySells || 0;

  // Emergency fund
  const emergencyFund = d.emergencyFund?.amount || 0;
  const emergencyMonths = d.emergencyFund?.monthsCovered || 0;
  const emergencyTarget = d.emergencyFund?.target || 0;
  const emergencyProgress = d.emergencyFund?.progress || 0;

  // Charts & extras
  const insights = d.insights || [];
  const historicalData = d.historicalData || [];
  const dailySpending = d.dailySpending || [];
  const recentTransactions = d.recentTransactions || [];
  const paymentMethodBreakdown = useMemo(
    () => attachColors(d.paymentMethodBreakdown || []),
    [d.paymentMethodBreakdown]
  );
  const incomeByCategory = useMemo(
    () => attachColors(d.incomeByCategory || []),
    [d.incomeByCategory]
  );
  const financialScore = d.financialScore || 50;

  const expenseCategories = useMemo(
    () => attachColors(d.expenseByCategory || []),
    [d.expenseByCategory]
  );

  /* -------------------------------------------------------------------------- */
  /*                                  UI START                                  */
  /* -------------------------------------------------------------------------- */

  const monthName = new Date(period.year, period.month - 1).toLocaleString(
    "en",
    { month: "long" }
  );

  const L = status.loading;

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

          <div className="flex gap-2 items-center flex-wrap">
            <button
              onClick={load}
              disabled={L}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition flex items-center gap-2 disabled:opacity-50"
              type="button"
            >
              <RefreshCw className={`w-4 h-4 ${L ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <select
              value={period.month}
              onChange={(e) =>
                setPeriod((p) => ({ ...p, month: Number(e.target.value) }))
              }
              className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
              className="w-20 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              min={2000}
              max={2100}
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Showing data for{" "}
          <span className="font-semibold">
            {monthName} {period.year}
          </span>
        </div>
      </header>

      {/* ERROR BANNER */}
      {status.error && (
        <div className="mb-6 bg-rose-50 text-rose-700 border border-rose-200 rounded-2xl px-5 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {status.error}
        </div>
      )}

      {/* FINANCIAL SCORE + INSIGHTS */}
      {!L && (
        <section className="grid lg:grid-cols-4 gap-5 mb-8">
          <FinancialScoreWidget score={financialScore} loading={L} />
          <div className="lg:col-span-3">
            {insights.length > 0 ? (
              <InsightsWidget insights={insights} />
            ) : (
              <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-6 h-full flex items-center justify-center">
                <p className="text-slate-400 text-sm">
                  No insights for this period yet. Add transactions to get
                  started.
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* KEY METRICS CARDS */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4 mb-8">
        <MetricCard
          title="Net Worth"
          value={formatRM(netWorth)}
          icon={<Wallet className="w-5 h-5 text-sky-600" />}
          loading={L}
          trend={netWorth > 0 ? "up" : netWorth < 0 ? "down" : "neutral"}
          subtitle="Assets - Debts"
        />
        <MetricCard
          title="Total Assets"
          value={formatRM(totalAssets)}
          icon={<ArrowUpCircle className="w-5 h-5 text-emerald-600" />}
          loading={L}
          subtitle="Cash + Savings + Invest"
        />
        <MetricCard
          title="Total Debts"
          value={formatRM(totalDebts)}
          icon={<ArrowDownCircle className="w-5 h-5 text-rose-600" />}
          loading={L}
          subtitle={
            debtBalance > 0
              ? `~${monthsToDebtFree}mo to debt-free`
              : "Debt-free!"
          }
        />
        <MetricCard
          title="Monthly Cashflow"
          value={formatRM(monthlyCashflow)}
          icon={<Activity className="w-5 h-5 text-indigo-600" />}
          loading={L}
          trend={
            monthlyCashflow > 0
              ? "up"
              : monthlyCashflow < 0
                ? "down"
                : "neutral"
          }
          subtitle="Income - Expenses"
        />
        <MetricCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          loading={L}
          subtitle={
            savingsRate >= 20
              ? "Excellent!"
              : savingsRate >= 10
                ? "Good"
                : "Improve"
          }
        />
        <MetricCard
          title="Debt-to-Income"
          value={`${debtToIncome.toFixed(1)}%`}
          icon={<Percent className="w-5 h-5 text-amber-600" />}
          loading={L}
          subtitle={
            debtToIncome < 30
              ? "Healthy"
              : debtToIncome < 40
                ? "Caution"
                : "High"
          }
        />
      </section>

      {/* INCOME VS EXPENSE TREND + EXPENSE BREAKDOWN */}
      <section className="grid lg:grid-cols-2 gap-5 mb-8">
        <ChartCard
          title="Income vs Expenses (6-Month Trend)"
          subtitle="Monthly comparison"
          icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
          loading={L}
        >
          {historicalData.length === 0 ? (
            <EmptyState text="No historical data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={historicalData} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => formatRM(value)}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="income" fill="#22c55e" name="Income" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="#f97316" name="Expenses" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Expense Breakdown"
          subtitle="Top categories"
          icon={<PieIcon className="w-4 h-4 text-cyan-500" />}
          loading={L}
        >
          {expenseCategories.length === 0 ? (
            <EmptyState text="No expense data for this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseCategories}
                  dataKey="value"
                  nameKey="name"
                  outerRadius={90}
                  innerRadius={45}
                  paddingAngle={2}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {expenseCategories.map((item, i) => (
                    <Cell key={i} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRM(value)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* CASHFLOW TREND + DAILY SPENDING */}
      <section className="grid lg:grid-cols-2 gap-5 mb-8">
        <ChartCard
          title="Cashflow Trend"
          subtitle="6-month net cashflow"
          icon={<LineIcon className="w-4 h-4 text-indigo-500" />}
          loading={L}
        >
          {historicalData.length === 0 ? (
            <EmptyState text="No data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={historicalData}>
                <defs>
                  <linearGradient id="cashflowGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(value) => formatRM(value)}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Area type="monotone" dataKey="cashflow" stroke="#6366f1" strokeWidth={2} fill="url(#cashflowGrad)" name="Cashflow" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Daily Spending"
          subtitle={`${monthName} ${period.year}`}
          icon={<Calendar className="w-4 h-4 text-rose-500" />}
          loading={L}
        >
          {dailySpending.length === 0 ? (
            <EmptyState text="No daily data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySpending}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={10} interval={4} />
                <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={(v) => `${v}`} />
                <Tooltip
                  formatter={(value) => formatRM(value)}
                  labelFormatter={(label) => `Day ${label}`}
                  contentStyle={{ borderRadius: "12px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                />
                <Bar dataKey="amount" fill="#f43f5e" name="Spent" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* BUDGET HEALTH + EMERGENCY FUND */}
      <section className="grid lg:grid-cols-3 gap-5 mb-8">
        <div className="lg:col-span-2">
          <BudgetHealthWidget
            totalBudget={totalBudget}
            budgetSpent={budgetSpent}
            budgetRemaining={budgetRemaining}
            budgetHealth={budgetHealth}
            budgetSections={budgetSections}
            loading={L}
          />
        </div>
        <div>
          <EmergencyFundWidget
            amount={emergencyFund}
            monthsCovered={emergencyMonths}
            target={emergencyTarget}
            progress={emergencyProgress}
            loading={L}
          />
        </div>
      </section>

      {/* ✅ INVESTMENT PORTFOLIO — Summary Cards + Top Performers */}
      <section className="mb-8">
        <InvestmentWidget
          totalInvestedMYR={investTotalInvestedMYR}
          currentValueMYR={investCurrentValueMYR}
          totalPL_MYR={investTotalPL_MYR}
          roi={investROI}
          assetCount={investAssetCount}
          topPerformers={investTopPerformers}
          monthlyBuys={investMonthlyBuys}
          monthlySells={investMonthlySells}
          loading={L}
        />
      </section>

      {/* SAVINGS + DEBTS OVERVIEW */}
      <section className="grid lg:grid-cols-2 gap-5 mb-8">
        <SavingsWidget
          savingsTotal={savingsTotal}
          savingsROI={savingsROI}
          monthlyDeposits={monthlyDeposits}
          monthlyDividends={monthlyDividendsSavings}
          totalDividends={d.savings?.totalDividends || 0}
          accounts={savingsAccounts}
          loading={L}
        />

        <DebtsWidget
          debtBalance={debtBalance}
          debtOriginal={debtOriginal}
          debtProgress={debtProgress}
          monthlyPayment={debtMonthlyPayment}
          interestPaid={debtInterestPaid}
          monthsToDebtFree={monthsToDebtFree}
          accounts={debtAccounts}
          upcomingPayments={upcomingPayments}
          loading={L}
        />
      </section>

      {/* PAYMENT METHOD + INCOME BREAKDOWN + RECENT TX */}
      <section className="grid lg:grid-cols-3 gap-5 mb-8">
        <ChartCard
          title="Payment Methods"
          subtitle="How you spend"
          icon={<CreditCard className="w-4 h-4 text-violet-500" />}
          loading={L}
        >
          {paymentMethodBreakdown.length === 0 ? (
            <EmptyState text="No data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={paymentMethodBreakdown} dataKey="value" nameKey="name" outerRadius={85} innerRadius={40} paddingAngle={2}>
                  {paymentMethodBreakdown.map((item, i) => (
                    <Cell key={i} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRM(value)} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Income Sources"
          subtitle="Where money comes from"
          icon={<DollarSign className="w-4 h-4 text-emerald-500" />}
          loading={L}
        >
          {incomeByCategory.length === 0 ? (
            <EmptyState text="No income data" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={incomeByCategory} dataKey="value" nameKey="name" outerRadius={85} innerRadius={40} paddingAngle={2}>
                  {incomeByCategory.map((item, i) => (
                    <Cell key={i} fill={item.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRM(value)} />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <RecentTransactionsWidget
          transactions={recentTransactions}
          loading={L}
          monthName={monthName}
        />
      </section>

      {/* NET WORTH BREAKDOWN */}
      <section className="mb-8">
        <NetWorthBreakdownWidget
          cash={cashBalance}
          savings={savingsBalance}
          investments={investmentsBalance}
          debts={totalDebts}
          netWorth={netWorth}
          loading={L}
        />
      </section>

      <footer className="text-center text-xs text-slate-400 mt-10 pb-4">
        FinTrack-Analysis • Comprehensive Dashboard
      </footer>
    </main>
  );
}

/* ========================================================================== */
/*                          REUSABLE COMPONENTS                               */
/* ========================================================================== */

const MetricCard = ({ title, value, icon, loading, trend, subtitle }) => (
  <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-4 border border-slate-100 shadow-sm flex flex-col">
    <div className="flex items-start justify-between mb-2">
      <div className="p-2 bg-sky-50 rounded-xl">{icon}</div>
      {trend && (
        <div
          className={`text-xs font-semibold px-1.5 py-0.5 rounded-md ${
            trend === "up"
              ? "text-emerald-600 bg-emerald-50"
              : trend === "down"
                ? "text-rose-600 bg-rose-50"
                : "text-slate-500 bg-slate-50"
          }`}
        >
          {trend === "up" ? "↑" : trend === "down" ? "↓" : "•"}
        </div>
      )}
    </div>
    <p className="text-xs text-slate-500 mb-1">{title}</p>
    <h3 className="text-base sm:text-lg font-bold text-[#0b1222]">
      {loading ? (
        <span className="inline-block h-5 w-20 bg-slate-200 rounded animate-pulse" />
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
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="h-[260px]">
      {loading ? <SkeletonBlock /> : children}
    </div>
  </div>
);

const EmptyState = ({ text }) => (
  <div className="h-full flex items-center justify-center text-sm text-slate-400">
    {text}
  </div>
);

const SkeletonBlock = () => (
  <div className="h-full w-full bg-slate-100 rounded-xl animate-pulse" />
);

const SkeletonRows = ({ count = 3 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="h-12 bg-slate-100 rounded-xl animate-pulse" />
    ))}
  </div>
);

const MiniStat = ({ label, value, color }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
    <p className="text-[11px] text-slate-600">{label}</p>
    <p className={`text-sm font-semibold ${color || "text-slate-900"}`}>
      {value}
    </p>
  </div>
);

const FinancialScoreWidget = ({ score, loading }) => {
  const sc = getScoreColor(score);

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 flex flex-col items-center justify-center">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-semibold text-[#0b1222]">Financial Score</h3>
      </div>
      {loading ? (
        <div className="h-28 w-28 bg-slate-100 rounded-full animate-pulse" />
      ) : (
        <>
          <div className="relative w-28 h-28 flex items-center justify-center">
            <svg className="w-28 h-28 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="none" />
              <circle
                cx="50" cy="50" r="42"
                stroke={score >= 80 ? "#22c55e" : score >= 60 ? "#3b82f6" : score >= 40 ? "#f59e0b" : "#ef4444"}
                strokeWidth="8" fill="none" strokeLinecap="round"
                strokeDasharray={`${(score / 100) * 264} 264`}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#0b1222]">{score}</span>
              <span className="text-[10px] text-slate-500">/100</span>
            </div>
          </div>
          <p className={`text-sm font-semibold mt-2 ${sc.text}`}>{sc.label}</p>
        </>
      )}
    </div>
  );
};

const InsightsWidget = ({ insights }) => (
  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6 shadow-sm h-full">
    <div className="flex items-center gap-3 mb-4">
      <div className="p-2 bg-amber-100 rounded-lg">
        <Zap className="w-5 h-5 text-amber-700" />
      </div>
      <div>
        <h3 className="text-base font-bold text-slate-900">Financial Insights</h3>
        <p className="text-xs text-slate-600">
          {insights.length} insight{insights.length !== 1 ? "s" : ""} for you
        </p>
      </div>
    </div>

    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto">
      {insights.map((insight, idx) => (
        <div
          key={idx}
          className={`rounded-xl border-2 p-3 ${
            insight.type === "warning" ? "bg-amber-50 border-amber-300"
              : insight.type === "alert" ? "bg-rose-50 border-rose-300"
              : insight.type === "success" ? "bg-emerald-50 border-emerald-300"
              : "bg-sky-50 border-sky-300"
          }`}
        >
          <div className="flex items-start gap-2">
            <div className="shrink-0 mt-0.5">
              {insight.type === "warning" ? <AlertTriangle className="w-4 h-4 text-amber-600" />
                : insight.type === "alert" ? <AlertCircle className="w-4 h-4 text-rose-600" />
                : insight.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                : <Info className="w-4 h-4 text-sky-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900">{insight.title}</p>
              <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{insight.message}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

/* ✅ SIMPLIFIED INVESTMENT WIDGET — Summary Cards + Top Performers */
const InvestmentWidget = ({
  totalInvestedMYR,
  currentValueMYR,
  totalPL_MYR,
  roi,
  assetCount,
  topPerformers,
  monthlyBuys,
  monthlySells,
  loading,
}) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-blue-50 rounded-lg">
          <Briefcase className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#0b1222]">
            Investment Portfolio
          </h3>
          <p className="text-xs text-slate-500">
            {assetCount} active asset{assetCount !== 1 ? "s" : ""} • Live prices (MYR)
          </p>
        </div>
      </div>
    </div>

    {loading ? (
      <SkeletonRows count={2} />
    ) : assetCount === 0 ? (
      <EmptyState text="No investment assets yet. Go to Investments page to add." />
    ) : (
      <>
        {/* Summary Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[11px] text-blue-600 font-medium">Total Invested</p>
            <p className="text-lg font-bold text-blue-800">{formatRM(totalInvestedMYR)}</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] text-emerald-600 font-medium">Current Value</p>
            <p className="text-lg font-bold text-emerald-800">{formatRM(currentValueMYR)}</p>
          </div>

          <div className={`rounded-xl border p-4 ${
            totalPL_MYR >= 0
              ? "border-emerald-200 bg-emerald-50"
              : "border-rose-200 bg-rose-50"
          }`}>
            <p className={`text-[11px] font-medium ${
              totalPL_MYR >= 0 ? "text-emerald-600" : "text-rose-600"
            }`}>
              Profit / Loss
            </p>
            <p className={`text-lg font-bold ${
              totalPL_MYR >= 0 ? "text-emerald-800" : "text-rose-800"
            }`}>
              {totalPL_MYR >= 0 ? "+" : ""}{formatRM(totalPL_MYR)}
            </p>
          </div>

          <div className={`rounded-xl border p-4 ${
            roi >= 0
              ? "border-violet-200 bg-violet-50"
              : "border-rose-200 bg-rose-50"
          }`}>
            <p className={`text-[11px] font-medium ${
              roi >= 0 ? "text-violet-600" : "text-rose-600"
            }`}>
              ROI
            </p>
            <p className={`text-lg font-bold ${
              roi >= 0 ? "text-violet-800" : "text-rose-800"
            }`}>
              {roi >= 0 ? "+" : ""}{roi.toFixed(2)}%
            </p>
          </div>
        </div>

        {/* Monthly Activity + Top Performers */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Monthly activity */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3">This Month Activity</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ArrowUpCircle className="w-3.5 h-3.5 text-emerald-500" /> Buys
                </span>
                <span className="text-sm font-semibold text-slate-900">{formatRM(monthlyBuys)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <ArrowDownCircle className="w-3.5 h-3.5 text-rose-500" /> Sells
                </span>
                <span className="text-sm font-semibold text-slate-900">{formatRM(monthlySells)}</span>
              </div>
            </div>
          </div>

          {/* Top Performers */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold text-slate-700 mb-3">Top Performers</p>
            {topPerformers.length === 0 ? (
              <p className="text-xs text-slate-400">No active holdings</p>
            ) : (
              <div className="space-y-2">
                {topPerformers.slice(0, 4).map((stock, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {stock.symbol}
                      </span>
                      {stock.change24h !== 0 && (
                        <span className={`text-[10px] font-medium ${
                          stock.change24h >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {stock.change24h >= 0 ? "+" : ""}{stock.change24h.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${
                      stock.plPercent >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {stock.plPercent >= 0 ? "+" : ""}{stock.plPercent.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    )}
  </div>
);

const BudgetHealthWidget = ({
  totalBudget,
  budgetSpent,
  budgetRemaining,
  budgetHealth,
  budgetSections,
  loading,
}) => {
  const [showSections, setShowSections] = useState(false);

  return (
    <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Target className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-[#0b1222]">Budget Health</h3>
            <p className="text-xs text-slate-500">Category performance</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">{formatRM(budgetSpent)}</p>
          <p className="text-xs text-slate-500">of {formatRM(totalBudget)} budget</p>
          <p className={`text-xs font-semibold mt-0.5 ${budgetRemaining >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {budgetRemaining >= 0
              ? `${formatRM(budgetRemaining)} remaining`
              : `${formatRM(Math.abs(budgetRemaining))} over`}
          </p>
        </div>
      </div>

      {totalBudget > 0 && (
        <div className="mb-4">
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                budgetRemaining < 0 ? "bg-rose-500"
                  : budgetSpent / totalBudget > 0.8 ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min((budgetSpent / totalBudget) * 100, 100)}%` }}
            />
          </div>
        </div>
      )}

      {loading ? (
        <SkeletonRows count={4} />
      ) : budgetHealth.length === 0 ? (
        <EmptyState text="No budgets set for this period" />
      ) : (
        <>
          {budgetSections?.length > 0 && (
            <button
              onClick={() => setShowSections(!showSections)}
              className="text-xs text-indigo-600 font-medium mb-3 flex items-center gap-1 hover:underline"
            >
              {showSections ? "Show by category" : "Show by section"}
              {showSections ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}

          <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
            {!showSections
              ? budgetHealth.map((item, idx) => <BudgetBar key={idx} item={item} />)
              : budgetSections
                  .filter((s) => s.kind !== "income")
                  .map((section, idx) => (
                    <div key={idx} className="mb-3">
                      <p className="text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                        {section.name}
                      </p>
                      {section.items.map((item, i) => (
                        <BudgetBar
                          key={i}
                          item={{
                            category: item.label,
                            budget: item.budget,
                            spent: item.spent,
                            percentage: item.percentage,
                            status: item.percentage >= 100 ? "over" : item.percentage >= 80 ? "warning" : "healthy",
                          }}
                        />
                      ))}
                    </div>
                  ))}
          </div>
        </>
      )}
    </div>
  );
};

const BudgetBar = ({ item }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3">
    <div className="flex items-center justify-between mb-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{item.category}</p>
        <p className="text-xs text-slate-500">{formatRM(item.spent)} / {formatRM(item.budget)}</p>
      </div>
      <div className={`px-2 py-0.5 rounded-lg text-xs font-semibold ${
        item.status === "over" ? "bg-rose-100 text-rose-700"
          : item.status === "warning" ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700"
      }`}>
        {item.percentage.toFixed(0)}%
      </div>
    </div>
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full ${
          item.status === "over" ? "bg-rose-500" : item.status === "warning" ? "bg-amber-500" : "bg-emerald-500"
        }`}
        style={{ width: `${Math.min(item.percentage, 100)}%` }}
      />
    </div>
  </div>
);

const EmergencyFundWidget = ({ amount, monthsCovered, target, progress, loading }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6 h-full">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 bg-violet-50 rounded-lg">
        <Shield className="w-5 h-5 text-violet-600" />
      </div>
      <div>
        <h3 className="text-base font-semibold text-[#0b1222]">Emergency Fund</h3>
        <p className="text-xs text-slate-500">Financial safety net</p>
      </div>
    </div>

    {loading ? (
      <SkeletonRows count={3} />
    ) : (
      <>
        <div className="text-center mb-4">
          <p className="text-3xl font-bold text-violet-700">{formatRM(amount)}</p>
          <p className="text-sm text-slate-600 mt-1">Covers {monthsCovered.toFixed(1)} months</p>
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
          <p className="text-xs text-slate-500 mt-1">Target: {formatRM(target)} (6 months)</p>
        </div>

        <div className={`rounded-xl border-2 p-3 text-center ${
          monthsCovered >= 6 ? "bg-emerald-50 border-emerald-300"
            : monthsCovered >= 3 ? "bg-amber-50 border-amber-300"
            : "bg-rose-50 border-rose-300"
        }`}>
          <p className={`text-sm font-semibold ${
            monthsCovered >= 6 ? "text-emerald-700"
              : monthsCovered >= 3 ? "text-amber-700"
              : "text-rose-700"
          }`}>
            {monthsCovered >= 6 ? "Excellent!" : monthsCovered >= 3 ? "Good, keep building" : "Build emergency fund"}
          </p>
        </div>
      </>
    )}
  </div>
);

const SavingsWidget = ({ savingsTotal, savingsROI, monthlyDeposits, monthlyDividends, totalDividends, accounts, loading }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-emerald-50 rounded-lg">
          <PiggyBank className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#0b1222]">Savings Overview</h3>
          <p className="text-xs text-slate-500">Total balance & ROI</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-emerald-700">{formatRM(savingsTotal)}</p>
        <p className="text-xs text-slate-500">ROI: {savingsROI.toFixed(2)}%</p>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-2 mb-4">
      <MiniStat label="This Month Deposits" value={formatRM(monthlyDeposits)} />
      <MiniStat label="This Month Dividends" value={formatRM(monthlyDividends)} color="text-emerald-700" />
      <MiniStat label="Total Dividends" value={formatRM(totalDividends)} color="text-emerald-700" />
    </div>

    {loading ? (
      <SkeletonRows count={3} />
    ) : accounts.length === 0 ? (
      <EmptyState text="No savings accounts yet" />
    ) : (
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {accounts.map((acc, idx) => (
          <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: acc.color || "#0ea5e9" }} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{acc.name}</p>
                {acc.goal > 0 && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(acc.progress, 100)}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-500">{acc.progress.toFixed(0)}%</span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-sm font-semibold text-slate-900">{formatRM(acc.balance)}</p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const DebtsWidget = ({ debtBalance, debtOriginal, debtProgress, monthlyPayment, interestPaid, monthsToDebtFree, accounts, upcomingPayments, loading }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-rose-50 rounded-lg">
          <CreditCard className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-[#0b1222]">Debt Overview</h3>
          <p className="text-xs text-slate-500">Outstanding & payments</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-lg font-bold text-rose-700">{formatRM(debtBalance)}</p>
        <p className="text-xs text-slate-500">
          {monthsToDebtFree > 0 ? `~${monthsToDebtFree} months left` : "Debt-free!"}
        </p>
      </div>
    </div>

    {debtOriginal > 0 && (
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-600 mb-1">
          <span>Repayment Progress</span>
          <span>{debtProgress.toFixed(0)}%</span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rose-500 to-orange-400 rounded-full transition-all"
            style={{ width: `${Math.min(debtProgress, 100)}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 mt-1">
          {formatRM(debtOriginal - debtBalance)} paid of {formatRM(debtOriginal)}
        </p>
      </div>
    )}

    <div className="grid grid-cols-2 gap-2 mb-4">
      <MiniStat label="Monthly Payment" value={formatRM(monthlyPayment)} />
      <MiniStat label="Interest Paid" value={formatRM(interestPaid)} color="text-rose-700" />
    </div>

    {upcomingPayments.length > 0 && (
      <div className="mb-3 rounded-xl border-2 border-amber-200 bg-amber-50 p-2.5">
        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {upcomingPayments.length} payment{upcomingPayments.length > 1 ? "s" : ""} due this month
        </p>
      </div>
    )}

    {loading ? (
      <SkeletonRows count={3} />
    ) : accounts.length === 0 ? (
      <div className="text-sm text-slate-500 text-center py-4">No debts — you're debt-free!</div>
    ) : (
      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {accounts.map((debt, idx) => (
          <div key={idx} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {debt.category} • {debt.lender}
                </p>
                <p className="text-[10px] text-slate-500">
                  {debt.interestRate.toFixed(2)}% p.a. • {formatRM(debt.monthlyPayment)}/mo
                </p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{formatRM(debt.balance)}</p>
            </div>
            {debt.originalAmount > 0 && (
              <div className="h-1 bg-slate-100 rounded-full overflow-hidden mt-1">
                <div className="h-full bg-rose-400 rounded-full" style={{ width: `${Math.min(debt.progressPercent || 0, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

const RecentTransactionsWidget = ({ transactions, loading, monthName }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5 sm:p-6">
    <div className="flex items-center gap-2 mb-4">
      <div className="p-2 bg-slate-100 rounded-lg">
        <Banknote className="w-5 h-5 text-slate-600" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[#0b1222]">Recent Transactions</h3>
        <p className="text-xs text-slate-500">{monthName} • Last 10</p>
      </div>
    </div>

    {loading ? (
      <SkeletonRows count={5} />
    ) : transactions.length === 0 ? (
      <EmptyState text="No transactions this period" />
    ) : (
      <div className="space-y-1.5 max-h-[310px] overflow-y-auto">
        {transactions.map((tx, idx) => (
          <div key={idx} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-slate-50 transition">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${tx.type === "income" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-900 truncate">{tx.category}</p>
                <p className="text-[10px] text-slate-400">Day {tx.day} • {tx.paymentMethod}</p>
              </div>
            </div>
            <p className={`text-xs font-semibold ${tx.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
              {tx.type === "income" ? "+" : "-"}{formatRM(tx.amount)}
            </p>
          </div>
        ))}
      </div>
    )}
  </div>
);

const NetWorthBreakdownWidget = ({ cash, savings, investments, debts, netWorth, loading }) => {
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
          <h3 className="text-base font-semibold text-[#0b1222]">Net Worth Breakdown</h3>
          <p className="text-xs text-slate-500">Assets & liabilities (all in MYR)</p>
        </div>
      </div>

      {loading ? (
        <div className="h-[200px] bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-3">
            {[
              { label: "Cash/Bank", value: cash, color: "bg-sky-500", textColor: "text-sky-700", bg: "bg-sky-50" },
              { label: "Savings", value: savings, color: "bg-emerald-500", textColor: "text-emerald-700", bg: "bg-emerald-50" },
              { label: "Investments", value: investments, color: "bg-violet-500", textColor: "text-violet-700", bg: "bg-violet-50" },
              { label: "Debts", value: debts, color: "bg-rose-500", textColor: "text-rose-700", bg: "bg-rose-50", negative: true },
            ].map((item, idx) => (
              <div key={idx} className={`flex items-center justify-between rounded-xl border border-slate-200 ${item.bg} p-3`}>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${item.color}`} />
                  <span className={`text-sm font-medium ${item.textColor}`}>{item.label}</span>
                </div>
                <span className={`text-sm font-semibold ${item.textColor}`}>
                  {item.negative ? "-" : ""}{formatRM(item.value)}
                </span>
              </div>
            ))}

            <div className="flex items-center justify-between rounded-xl border-2 border-slate-900 bg-slate-900 p-3">
              <span className="text-sm font-bold text-white">Net Worth</span>
              <span className="text-sm font-bold text-white">{formatRM(netWorth)}</span>
            </div>
          </div>

          <div className="flex items-center justify-center">
            {data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" outerRadius={80} innerRadius={35} paddingAngle={2}>
                    {data.map((item, i) => (
                      <Cell key={i} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRM(Math.abs(value))} />
                  <Legend wrapperStyle={{ fontSize: "11px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState text="No data" />
            )}
          </div>
        </div>
      )}
    </div>
  );
};