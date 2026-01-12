import { useEffect, useMemo } from "react";
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  PiggyBank,
  AlertTriangle,
  Info,
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

export default function Dashboard() {
  useEffect(() => window.scrollTo(0, 0), []);

  /* -------------------------------------------------------------------------- */
  /*                             DEMO DASHBOARD DATA                            */
  /* -------------------------------------------------------------------------- */

  // High-level summaries
  const cashBalance = 8420;
  const savingsTotal = 2942;
  const investmentsTotal = 10350;
  const totalAssets = cashBalance + savingsTotal + investmentsTotal;

  const carLoan = 31800;
  const houseLoan = 247400;
  const ptptnLoan = 13877;
  const bnplLoan = 450;
  const creditCardDebt = 950;

  const totalDebts =
    carLoan + houseLoan + ptptnLoan + bnplLoan + creditCardDebt;

  const monthlyIncome = 3200;
  const monthlyExpenses = 1450;
  const monthlySavings = 600;
  const monthlyDebtPayments = 520 + 1250 + 150 + 150 + 200;

  const netWorth = totalAssets - totalDebts;
  const lastMonthNetWorth = netWorth - 4200;
  const netWorthChange = netWorth - lastMonthNetWorth;

  const savingsRate = (monthlySavings / monthlyIncome) * 100;
  const debtToIncome = (monthlyDebtPayments / monthlyIncome) * 100;

  /* -------------------------------------------------------------------------- */
  /*                                 CHART DATA                                 */
  /* -------------------------------------------------------------------------- */

  // Net Worth Trend
  const netWorthTrend = [
    { month: "Jan", value: 21000 },
    { month: "Feb", value: 22000 },
    { month: "Mar", value: 23150 },
    { month: "Apr", value: 24100 },
    { month: "May", value: 25200 },
    { month: "Jun", value: 26050 },
    { month: "Jul", value: 26900 },
    { month: "Aug", value: 27800 },
    { month: "Sep", value: 28850 },
    { month: "Oct", value: 29600 },
    { month: "Nov", value: 30500 },
    { month: "Dec", value: netWorth },
  ];

  // Income vs Expense
  const incomeExpenseChart = [
    { month: "Aug", income: 3200, expenses: 1400 },
    { month: "Sep", income: 3200, expenses: 1450 },
    { month: "Oct", income: 3200, expenses: 1500 },
    { month: "Nov", income: 3200, expenses: 1450 },
    { month: "Dec", income: monthlyIncome, expenses: monthlyExpenses },
  ];

  // Savings Growth (multi-account)
  const savingsGrowth = [
    { month: "Aug", ASB: 4800, Versa: 1900, TNG: 1300 },
    { month: "Sep", ASB: 5000, Versa: 1950, TNG: 1400 },
    { month: "Oct", ASB: 5200, Versa: 2000, TNG: 1500 },
    { month: "Nov", ASB: 5400, Versa: 2050, TNG: 1550 },
    { month: "Dec", ASB: 5600, Versa: 2100, TNG: 1600 },
  ];

  // Expense Breakdown
  const expenseCategories = [
    { name: "Food & Groceries", value: 450, color: "#0284c7" },
    { name: "Transport", value: 300, color: "#38bdf8" },
    { name: "Rent & Bills", value: 680, color: "#0ea5e9" },
    { name: "Subscriptions", value: 60, color: "#7dd3fc" },
    { name: "Shopping/Other", value: 200, color: "#1d4ed8" },
  ];

  // Debts (Monthly + Pie)
  const debts = [
    {
      name: "Car Loan",
      balance: carLoan,
      monthly: 520,
      interest: 3.1,
      color: "#2563eb",
    },
    {
      name: "House Loan",
      balance: houseLoan,
      monthly: 1250,
      interest: 3.9,
      color: "#7c3aed",
    },
    {
      name: "PTPTN",
      balance: ptptnLoan,
      monthly: 150,
      interest: 1.0,
      color: "#10b981",
    },
    {
      name: "BNPL",
      balance: bnplLoan,
      monthly: 150,
      interest: 1.5,
      color: "#fb923c",
    },
    {
      name: "Credit Card",
      balance: creditCardDebt,
      monthly: 200,
      interest: 18,
      color: "#ef4444",
    },
  ];

  const debtsBarData = debts.map((d) => ({
    name: d.name,
    monthly: d.monthly,
    color: d.color,
  }));

  const debtPieData = debts.map((d) => ({
    name: d.name,
    value: d.balance,
    color: d.color,
  }));

  const totalMonthlyDebt = debts.reduce((a, b) => a + b.monthly, 0);

  const totalSavingsGrowth =
    savingsGrowth[savingsGrowth.length - 1].ASB +
    savingsGrowth[savingsGrowth.length - 1].Versa +
    savingsGrowth[savingsGrowth.length - 1].TNG;

  /* -------------------------------------------------------------------------- */
  /*                             INVESTMENT SECTION                             */
  /* -------------------------------------------------------------------------- */

  const investments = [
    {
      name: "NVIDIA (NVDA)",
      type: "Stock",
      value: 3750,
      roi: 50,
      color: "#2563eb",
    },
    {
      name: "Bitcoin (BTC)",
      type: "Crypto",
      value: 5200,
      roi: 73,
      color: "#f59e0b",
    },
    {
      name: "Ethereum (ETH)",
      type: "Crypto",
      value: 2100,
      roi: 40,
      color: "#7c3aed",
    },
    {
      name: "Maybank",
      type: "Stock",
      value: 2300,
      roi: 15,
      color: "#16a34a",
    },
    {
      name: "VOO ETF",
      type: "ETF",
      value: 1400,
      roi: 16.6,
      color: "#f97316",
    },
  ];

  const bestInvestment = investments.reduce((a, b) => (a.roi > b.roi ? a : b));

  const worstInvestment = investments.reduce((a, b) => (a.roi < b.roi ? a : b));

  const portfolioAllocation = investments.map((i) => ({
    name: i.name,
    value: i.value,
    color: i.color,
  }));

  const investmentTrend = [
    { month: "Aug", value: 8800 },
    { month: "Sep", value: 9100 },
    { month: "Oct", value: 9500 },
    { month: "Nov", value: 9900 },
    { month: "Dec", value: investmentsTotal },
  ];

  /* -------------------------------------------------------------------------- */
  /*                             EMERGENCY FUND LOGIC                           */
  /* -------------------------------------------------------------------------- */

  const emergencyFund = cashBalance + savingsTotal;
  const monthsCovered = emergencyFund / monthlyExpenses;
  const emergencyProgress = Math.min((monthsCovered / 6) * 100, 100);

  /* -------------------------------------------------------------------------- */
  /*                                   UI START                                 */
  /* -------------------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f7fbff] via-[#ecf2ff] to-[#dbe8ff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0b1222]">
          Financial Dashboard
        </h1>
        <p className="text-gray-600 text-sm mt-1">
          Complete summary of your financial health.
        </p>
      </header>

      {/* SUMMARY CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-5 mb-10">
        <SummaryCard
          title="Net Worth"
          value={`RM ${netWorth.toLocaleString()}`}
          icon={<Wallet className="w-6 h-6 text-sky-600" />}
        />
        <SummaryCard
          title="Total Assets"
          value={`RM ${totalAssets.toLocaleString()}`}
          icon={<ArrowUpCircle className="w-6 h-6 text-emerald-600" />}
        />
        <SummaryCard
          title="Total Debts"
          value={`RM ${totalDebts.toLocaleString()}`}
          icon={<ArrowDownCircle className="w-6 h-6 text-rose-600" />}
        />
        <SummaryCard
          title="Savings Growth (Total)"
          value={`RM ${totalSavingsGrowth.toLocaleString()}`}
          icon={<PiggyBank className="w-6 h-6 text-indigo-600" />}
        />
        <SummaryCard
          title="Monthly Debt Commitments"
          value={`RM ${totalMonthlyDebt.toLocaleString()}`}
          icon={<Banknote className="w-6 h-6 text-amber-600" />}
        />
        <SummaryCard
          title="Savings Rate"
          value={`${savingsRate.toFixed(1)}%`}
          icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
        />
      </section>

      {/* NET WORTH + INCOME VS EXPENSE */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <ChartCard
          title="Net Worth Trend"
          subtitle="12 months"
          icon={<LineIcon className="w-4 h-4 text-sky-500" />}
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
          subtitle="Monthly"
          icon={<BarChart3 className="w-4 h-4 text-emerald-500" />}
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

      {/* INSIGHTS */}
      <section className="grid lg:grid-cols-3 gap-6 mb-12">
        <InsightCard
          title="Best Performing Asset"
          highlight={`+${bestInvestment.roi}%`}
          description={bestInvestment.name}
        />
        <InsightCard
          title="Lowest Performing Asset"
          highlight={`${worstInvestment.roi}%`}
          description={worstInvestment.name}
        />
        <InsightCard
          title="Debt-To-Income Ratio"
          highlight={`${debtToIncome.toFixed(1)}%`}
          description="Debt load health"
        />
      </section>

      {/* SAVINGS + EXPENSE BREAKDOWN */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <ChartCard
          title="Savings Growth by Account"
          subtitle="ASB, Versa-i, TNG"
          icon={<LineIcon className="w-4 h-4 text-indigo-500" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={savingsGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="ASB"
                stroke="#0ea5e9"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="Versa"
                stroke="#22c55e"
                strokeWidth={3}
              />
              <Line
                type="monotone"
                dataKey="TNG"
                stroke="#f59e0b"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Expense Breakdown"
          subtitle="Spending categories"
          icon={<PieIcon className="w-4 h-4 text-cyan-500" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={expenseCategories} dataKey="value" outerRadius={100}>
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

      {/* DEBTS SECTION */}
      <section className="grid lg:grid-cols-3 gap-8 mb-12">
        <ChartCard
          title="Monthly Debt Commitments"
          subtitle="Loans & BNPL"
          icon={<BarChart3 className="w-4 h-4 text-rose-500" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={debtsBarData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="monthly">
                {debtsBarData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Debt Distribution"
          subtitle="Remaining balances"
          icon={<PieIcon className="w-4 h-4 text-purple-500" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={debtPieData} dataKey="value" outerRadius={80}>
                {debtPieData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Emergency Fund */}
        <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <h2 className="text-sm font-semibold text-[#0b1222] flex items-center gap-2">
            <Coins className="w-4 h-4 text-violet-500" />
            Emergency Fund Status
          </h2>

          <p className="text-xl font-bold mt-2">
            RM {emergencyFund.toLocaleString()}
          </p>

          <p className="text-xs text-gray-600 mt-1">
            Covers {monthsCovered.toFixed(1)} months
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
      </section>

      {/* INVESTMENT SECTION */}
      <section className="grid lg:grid-cols-3 gap-8 mb-12">
        {/* Investment Trend */}
        <ChartCard
          title="Investment Portfolio Trend"
          subtitle="Portfolio value"
          icon={<TrendingUp className="w-4 h-4 text-green-600" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={investmentTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Line dataKey="value" stroke="#22c55e" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Portfolio Allocation */}
        <ChartCard
          title="Portfolio Allocation"
          subtitle="Assets breakdown"
          icon={<PieIcon className="w-4 h-4 text-indigo-600" />}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={portfolioAllocation} dataKey="value" outerRadius={90}>
                {portfolioAllocation.map((p, i) => (
                  <Cell key={i} fill={p.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top & Bottom Performers */}
        <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-6 border shadow-sm flex flex-col gap-4">
          <div>
            <p className="text-sm font-semibold text-[#0b1222]">
              Top Performer
            </p>
            <TopInvestmentCard investment={bestInvestment} />
          </div>

          <div>
            <p className="text-sm font-semibold text-[#0b1222]">
              Lowest Performer
            </p>
            <TopInvestmentCard investment={worstInvestment} worst />
          </div>
        </div>
      </section>

      {/* GOALS */}
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
            const progress = Math.min((goal.current / goal.target) * 100, 100);

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

      {/* FOOTER */}
      <footer className="text-center text-xs text-gray-400 mt-10">
        FinTrack-Analysis UI Prototype • 2025
      </footer>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                             REUSABLE COMPONENTS                             */
/* -------------------------------------------------------------------------- */

const SummaryCard = ({ title, value, icon }) => (
  <div className="bg-white/85 backdrop-blur-lg rounded-2xl p-4 border shadow-sm flex items-center justify-between">
    <div>
      <p className="text-xs text-gray-500">{title}</p>
      <h3 className="text-lg font-semibold text-[#0b1222]">{value}</h3>
    </div>
    <div className="p-2 bg-sky-50 rounded-xl">{icon}</div>
  </div>
);

const ChartCard = ({ title, subtitle, icon, children }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl border shadow-sm p-6">
    <div className="flex justify-between items-center mb-3">
      <h2 className="text-sm font-semibold flex items-center gap-2 text-[#0b1222]">
        {icon} {title}
      </h2>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
    </div>
    <div className="h-[260px]">{children}</div>
  </div>
);

const InsightCard = ({ title, highlight, description }) => (
  <div className="bg-white/85 backdrop-blur-lg rounded-2xl border p-5 shadow-sm">
    <p className="text-xs text-gray-500">{title}</p>
    <p className="text-sm font-semibold mt-1 text-[#0b1222]">{description}</p>
    <p className="text-sm font-bold text-sky-600 mt-1">{highlight}</p>
  </div>
);

const TopInvestmentCard = ({ investment, worst }) => (
  <div className="p-4 border rounded-xl bg-gradient-to-br from-white to-blue-50/40">
    <p className="text-sm font-semibold text-[#0b1222]">{investment.name}</p>
    <p className="text-xs text-gray-500">{investment.type}</p>
    <p
      className={`text-sm font-semibold mt-1 ${
        !worst ? "text-emerald-600" : "text-rose-600"
      }`}
    >
      {investment.roi >= 0 ? "+" : ""}
      {investment.roi}%
    </p>
  </div>
);
