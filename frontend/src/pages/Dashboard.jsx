import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  PiggyBank,
  Target,
  Bike,
  Laptop,
  Coins,
  Banknote,
  BarChart3,
  PieChart as PieIcon,
  LineChart as LineIcon,
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
];

function attachColors(items) {
  return (items || []).map((it, idx) => ({
    ...it,
    color: PIE_COLORS[idx % PIE_COLORS.length],
  }));
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

  // Data from backend
  const [me, setMe] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [dashboard, setDashboard] = useState({
    totals: { income: 0, expense: 0, cashflow: 0 },
    expenseByCategory: [],
    month: { year: period.year, month: period.month },
  });

  async function load() {
    setStatus({ loading: true, error: "" });
    try {
      const [meRes, accRes, dashRes] = await Promise.all([
        apiFetch("/api/auth/me"),
        apiFetch("/api/accounts"),
        apiFetch(`/api/dashboard?year=${period.year}&month=${period.month}`),
      ]);

      setMe(meRes.user || null);
      setAccounts(accRes.accounts || []);
      setDashboard({
        month: dashRes.month || { year: period.year, month: period.month },
        totals: dashRes.totals || { income: 0, expense: 0, cashflow: 0 },
        expenseByCategory: dashRes.expenseByCategory || [],
      });

      setStatus({ loading: false, error: "" });
    } catch (err) {
      // If token invalid/expired => redirect to login
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
  /*                     REAL DATA (from backend) + SAFE FALLBACKS              */
  /* -------------------------------------------------------------------------- */

  // Monthly numbers now come from backend
  const monthlyIncome = dashboard.totals.income || 0;
  const monthlyExpenses = dashboard.totals.expense || 0;
  const monthlySavings = Math.max(monthlyIncome - monthlyExpenses, 0); // simple derived metric for now

  // Assets from accounts (openingBalance only for now — later we’ll compute running balance)
  const cashBalance = useMemo(() => {
    const cashLike = new Set(["cash", "bank", "ewallet"]);
    return accounts
      .filter((a) => cashLike.has(a.type))
      .reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);
  }, [accounts]);

  const savingsTotal = useMemo(() => {
    return accounts
      .filter((a) => a.type === "savings")
      .reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);
  }, [accounts]);

  const investmentsTotal = useMemo(() => {
    return accounts
      .filter((a) => a.type === "investment")
      .reduce((sum, a) => sum + (Number(a.openingBalance) || 0), 0);
  }, [accounts]);

  const totalAssets = cashBalance + savingsTotal + investmentsTotal;

  // Debts not implemented yet -> show 0 for now (we’ll wire once Debts module exists)
  const totalDebts = 0;
  const netWorth = totalAssets - totalDebts;

  // Ratios
  const savingsRate =
    monthlyIncome > 0 ? (monthlySavings / monthlyIncome) * 100 : 0;

  const monthlyDebtPayments = 0;

  const debtToIncome =
    monthlyIncome > 0 ? (monthlyDebtPayments / monthlyIncome) * 100 : 0;

  /* -------------------------------------------------------------------------- */
  /*                                  CHART DATA                                */
  /* -------------------------------------------------------------------------- */

  // Expense Breakdown: now REAL from backend
  const expenseCategories = useMemo(
    () => attachColors(dashboard.expenseByCategory),
    [dashboard]
  );

  // Income vs Expense: we only have selected month from backend right now.
  // Keep chart valid by showing last 5 months with placeholders except current month.
  const incomeExpenseChart = useMemo(() => {
    const months = ["Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentLabel = new Date(period.year, period.month - 1).toLocaleString(
      "en",
      {
        month: "short",
      }
    );

    // Put the real data into the last item
    return [
      ...months.slice(0, 4).map((m) => ({ month: m, income: 0, expenses: 0 })),
      { month: currentLabel, income: monthlyIncome, expenses: monthlyExpenses },
    ];
  }, [monthlyIncome, monthlyExpenses, period.year, period.month]);

  // Net Worth Trend: placeholder trend + current net worth (until we store historical net worth)
  const netWorthTrend = useMemo(() => {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return months.map((m, idx) => ({
      month: m,
      value: idx === 11 ? netWorth : 0,
    }));
  }, [netWorth]);

  /* -------------------------------------------------------------------------- */
  /*                             EMERGENCY FUND LOGIC                            */
  /* -------------------------------------------------------------------------- */
  const emergencyFund = cashBalance + savingsTotal;
  const monthsCovered =
    monthlyExpenses > 0 ? emergencyFund / monthlyExpenses : 0;
  const emergencyProgress = Math.min((monthsCovered / 6) * 100, 100);

  /* -------------------------------------------------------------------------- */
  /*                                  UI START                                  */
  /* -------------------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7fbff] via-[#ecf2ff] to-[#dbe8ff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#0b1222]">
            Financial Dashboard
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            {me?.name ? `Hi, ${me.name} — ` : ""}Complete summary of your
            financial health.
          </p>
        </div>

        {/* Simple period selector (month/year) */}
        <div className="flex gap-2 items-center">
          <select
            value={period.month}
            onChange={(e) =>
              setPeriod((p) => ({ ...p, month: Number(e.target.value) }))
            }
            className="px-3 py-2 rounded-xl border border-gray-200 bg-white/80"
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
            className="w-28 px-3 py-2 rounded-xl border border-gray-200 bg-white/80"
            min={2000}
            max={2100}
          />
        </div>
      </header>

      {/* STATUS BANNER */}
      {status.error && (
        <div className="mb-6 bg-red-50 text-red-700 border border-red-200 rounded-2xl px-5 py-3 text-sm">
          {status.error}
        </div>
      )}

      {/* SUMMARY CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5 mb-10">
        <SummaryCard
          title="Net Worth"
          value={`RM ${netWorth.toLocaleString()}`}
          icon={<Wallet className="w-6 h-6 text-sky-600" />}
          loading={status.loading}
        />
        <SummaryCard
          title="Total Assets"
          value={`RM ${totalAssets.toLocaleString()}`}
          icon={<ArrowUpCircle className="w-6 h-6 text-emerald-600" />}
          loading={status.loading}
        />
        <SummaryCard
          title="Total Debts"
          value={`RM ${totalDebts.toLocaleString()}`}
          icon={<ArrowDownCircle className="w-6 h-6 text-rose-600" />}
          loading={status.loading}
        />
        <SummaryCard
          title="Cashflow (This Month)"
          value={`RM ${(dashboard.totals.cashflow || 0).toLocaleString()}`}
          icon={<PiggyBank className="w-6 h-6 text-indigo-600" />}
          loading={status.loading}
        />
        <SummaryCard
          title="Monthly Debt Commitments"
          value={`RM ${monthlyDebtPayments.toLocaleString()}`}
          icon={<Banknote className="w-6 h-6 text-amber-600" />}
          loading={status.loading}
        />
        <SummaryCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
          loading={status.loading}
        />
        <SummaryCard
          title="Debt-To-Income"
          value={`${debtToIncome.toFixed(1)}%`}
          icon={<TrendingUp className="w-6 h-6 text-rose-600" />}
          loading={status.loading}
        />
      </section>

      {/* NET WORTH + INCOME VS EXPENSE */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <ChartCard
          title="Net Worth Trend"
          subtitle="(Historical net worth will be real once we store snapshots)"
          icon={<LineIcon className="w-4 h-4 text-sky-500" />}
          loading={status.loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={netWorthTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0ea5e9"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Income vs Expenses"
          subtitle="Current month is real (others will be real when we add monthly history endpoint)"
          icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
          loading={status.loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={incomeExpenseChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Bar dataKey="income" fill="#22c55e" />
              <Bar dataKey="expenses" fill="#f97316" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* ACCOUNTS + EXPENSE BREAKDOWN */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <ChartCard
          title="Accounts Summary"
          subtitle="Using opening balances (we’ll upgrade to true running balances)"
          icon={<LineIcon className="w-4 h-4 text-indigo-500" />}
          loading={status.loading}
        >
          <div className="h-full flex flex-col gap-3 overflow-auto">
            {accounts.length === 0 && !status.loading && (
              <div className="text-sm text-gray-500">
                No accounts yet. Create an account to see balances here.
              </div>
            )}

            {accounts.map((a) => (
              <div
                key={a._id || a.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 bg-white/80 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-semibold text-[#0b1222]">
                    {a.name}
                  </p>
                  <p className="text-xs text-gray-500">{a.type}</p>
                </div>
                <p className="text-sm font-semibold text-[#0b1222]">
                  RM {Number(a.openingBalance || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </ChartCard>

        <ChartCard
          title="Expense Breakdown"
          subtitle="Real data from backend"
          icon={<PieIcon className="w-4 h-4 text-cyan-500" />}
          loading={status.loading}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={expenseCategories}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
              >
                {expenseCategories.map((item, i) => (
                  <Cell key={i} fill={item.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      {/* EMERGENCY FUND */}
      <section className="grid lg:grid-cols-3 gap-8 mb-12">
        <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col lg:col-span-1">
          <h2 className="text-sm font-semibold text-[#0b1222] flex items-center gap-2">
            <Coins className="w-4 h-4 text-violet-500" />
            Emergency Fund Status
          </h2>

          <p className="text-xl font-bold mt-2">
            RM {emergencyFund.toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Covers {monthsCovered.toFixed(1)} months (based on this month’s
            expenses)
          </p>

          <div className="mt-4">
            <div className="h-2 bg-slate-100 rounded-full">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-sky-500 rounded-full"
                style={{ width: `${emergencyProgress}%` }}
              />
            </div>
            <p className="text-xs mt-2 text-gray-500">
              Goal: RM {(monthlyExpenses * 6).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm lg:col-span-2">
          <p className="text-sm font-semibold text-[#0b1222] mb-2">
            Next: Debts + Investments + Savings history
          </p>
          <p className="text-xs text-gray-600">
            Dashboard is now connected to backend for:{" "}
            <span className="font-medium">
              Auth, Accounts, Monthly Income/Expenses, Expense Breakdown
            </span>
            .
            <br />
            Next we’ll add: debt tracker, investment tracker, and monthly trend
            endpoints so your charts become 100% real.
          </p>
        </div>
      </section>

      {/* GOALS (still UI prototype for now) */}
      <section className="mb-16">
        <h2 className="text-lg font-semibold text-[#0b1222] mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-sky-500" />
          Goals & Milestones
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              id: 1,
              title: "Laptop Fund (Mar 2026)",
              current: 2300,
              target: 5000,
              due: "Mar 2026",
              color: "#0ea5e9",
              icon: <Laptop className="w-5 h-5 text-sky-600" />,
            },
            {
              id: 2,
              title: "Motorcycle Fund",
              current: 0,
              target: 14000,
              due: "Dec 2026",
              color: "#10b981",
              icon: <Bike className="w-5 h-5 text-green-600" />,
            },
            {
              id: 3,
              title: "Emergency Fund",
              current: emergencyFund,
              target: monthlyExpenses * 6,
              due: "Ongoing",
              color: "#7c3aed",
              icon: <PiggyBank className="w-5 h-5 text-purple-600" />,
            },
          ].map((goal) => {
            const progress =
              goal.target > 0
                ? Math.min((goal.current / goal.target) * 100, 100)
                : 0;

            return (
              <div
                key={goal.id}
                className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm"
              >
                <div className="flex justify-between items-center mb-2">
                  {goal.icon}
                  <span className="text-xs text-gray-400">{goal.due}</span>
                </div>
                <p className="font-medium">{goal.title}</p>
                <p className="text-xs mt-1 text-gray-500">
                  RM {goal.current.toLocaleString()} / RM{" "}
                  {goal.target.toLocaleString()}
                </p>
                <div className="h-2 bg-slate-100 rounded-full mt-3">
                  <div
                    className="h-full rounded-full"
                    style={{ background: goal.color, width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  {progress.toFixed(1)}% complete
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="text-center text-xs text-gray-400 mt-10">
        FinTrack-Analysis • Dashboard connected (Auth/Accounts/Monthly Totals)
      </footer>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                             REUSABLE COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const SummaryCard = ({ title, value, icon, loading }) => (
  <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-4 border shadow-sm flex items-center justify-between">
    <div>
      <p className="text-xs text-gray-500">{title}</p>
      <h3 className="text-lg font-semibold text-[#0b1222]">
        {loading ? (
          <span className="inline-block h-5 w-24 bg-slate-200 rounded animate-pulse" />
        ) : (
          value
        )}
      </h3>
    </div>
    <div className="p-2 bg-sky-50 rounded-xl">{icon}</div>
  </div>
);

const ChartCard = ({ title, subtitle, icon, children, loading }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border shadow-sm p-6">
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-sm font-semibold flex items-center gap-2 text-[#0b1222]">
        {icon} {title}
      </h2>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
    <div className="h-[260px]">
      {loading ? (
        <div className="h-full w-full bg-slate-100 rounded-xl animate-pulse" />
      ) : (
        children
      )}
    </div>
  </div>
);
