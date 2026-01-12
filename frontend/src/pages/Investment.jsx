import { useState, useMemo } from "react";
import {
  TrendingUp,
  DollarSign,
  BarChart2,
  PieChart,
  ArrowUpCircle,
  ArrowDownCircle,
  Bitcoin,
  LineChart,
  Globe,
  Plus,
  Star,
} from "lucide-react";
import {
  PieChart as RePieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ComposedChart,
} from "recharts";
import AddInvestmentModal from "../components/AddInvestmentModal";

export default function InvestmentPage() {
  const [activeTab, setActiveTab] = useState("portfolio");
  const [showModal, setShowModal] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [chartFilter, setChartFilter] = useState("all"); // "all" | "stock" | "crypto"

  // 💼 User portfolio with realistic demo data
  const [investments, setInvestments] = useState([
    {
      id: 1,
      type: "Stock",
      name: "NVIDIA Corp (NVDA)",
      symbol: "NVDA",
      invested: 2500,
      currentValue: 3750,
      units: 5,
      avgPrice: 500,
      change: 50,
      color: "#2563eb",
      category: "Technology",
      dividendYield: 0.01, // 1% yearly (demo)
      dividendFrequency: "quarterly",
      autoInvestEnabled: true,
      autoInvestAmount: 500,
    },
    {
      id: 2,
      type: "Stock",
      name: "Maybank (1155.KL)",
      symbol: "MAYBANK",
      invested: 2000,
      currentValue: 2300,
      units: 400,
      avgPrice: 5,
      change: 15,
      color: "#16a34a",
      category: "Banking",
      dividendYield: 0.05,
      dividendFrequency: "yearly",
      autoInvestEnabled: false,
      autoInvestAmount: 200,
    },
    {
      id: 3,
      type: "ETF",
      name: "Vanguard S&P 500 ETF (VOO)",
      symbol: "VOO",
      invested: 1200,
      currentValue: 1400,
      units: 3,
      avgPrice: 400,
      change: 16.6,
      color: "#f97316",
      category: "ETF",
      dividendYield: 0.014,
      dividendFrequency: "quarterly",
      autoInvestEnabled: true,
      autoInvestAmount: 300,
    },
    {
      id: 4,
      type: "Crypto",
      name: "Bitcoin (BTC)",
      symbol: "BTC",
      invested: 3000,
      currentValue: 5200,
      units: 0.05,
      avgPrice: 60000,
      change: 73,
      color: "#f59e0b",
      category: "Crypto",
      dividendYield: 0,
      dividendFrequency: "none",
      autoInvestEnabled: false,
      autoInvestAmount: 0,
    },
    {
      id: 5,
      type: "Crypto",
      name: "Ethereum (ETH)",
      symbol: "ETH",
      invested: 1500,
      currentValue: 2100,
      units: 0.4,
      avgPrice: 3750,
      change: 40,
      color: "#7c3aed",
      category: "Crypto",
      dividendYield: 0,
      dividendFrequency: "none",
      autoInvestEnabled: false,
      autoInvestAmount: 0,
    },
  ]);

  // 🌍 Market overview demo data
  const market = [
    {
      name: "Apple Inc.",
      symbol: "AAPL",
      type: "Stock",
      price: 236.42,
      change: 1.32,
      marketCap: "3.7T",
      color: "#2563eb",
    },
    {
      name: "Tesla Inc.",
      symbol: "TSLA",
      type: "Stock",
      price: 198.77,
      change: -0.65,
      marketCap: "625B",
      color: "#ef4444",
    },
    {
      name: "Malayan Banking Bhd.",
      symbol: "MayBank",
      type: "Stock",
      price: 9.12,
      change: 0.87,
      marketCap: "120B",
      color: "#e9af0eff",
    },
    {
      name: "Microsoft Corp.",
      symbol: "MSFT",
      type: "Stock",
      price: 425.12,
      change: 0.87,
      marketCap: "3.4T",
      color: "#0ea5e9",
    },
    {
      name: "Vanguard Total World ETF",
      symbol: "VT",
      type: "ETF",
      price: 117.33,
      change: 0.55,
      marketCap: "1.2T",
      color: "#22c55e",
    },
    {
      name: "Bitcoin (BTC)",
      symbol: "BTC",
      type: "Crypto",
      price: 102_850,
      change: 2.42,
      marketCap: "2.01T",
      color: "#f59e0b",
    },
    {
      name: "Ethereum (ETH)",
      symbol: "ETH",
      type: "Crypto",
      price: 5_270,
      change: 1.95,
      marketCap: "702B",
      color: "#7c3aed",
    },
  ];

  // 🧾 Activity log for actions (auto-buy, withdraw, dividend, etc.)
  const [activityLog, setActivityLog] = useState([
    {
      id: 1,
      date: "2025-10-05",
      type: "Dividend",
      asset: "Maybank",
      amount: 45,
      status: "Received",
    },
    {
      id: 2,
      date: "2025-11-01",
      type: "Auto Buy",
      asset: "VOO",
      amount: 300,
      status: "Completed",
    },
  ]);

  // 📊 Portfolio totals (all investments)
  const totals = useMemo(() => {
    const invested = investments.reduce((a, b) => a + b.invested, 0);
    const value = investments.reduce((a, b) => a + b.currentValue, 0);
    const profit = value - invested;
    const roi = ((profit / invested) * 100).toFixed(2);
    return { invested, value, profit, roi };
  }, [investments]);

  // 🔍 Filtered investments for charts (all / stocks / crypto)
  const filteredInvestments = useMemo(() => {
    if (chartFilter === "crypto") {
      return investments.filter((inv) => inv.type === "Crypto");
    }
    if (chartFilter === "stock") {
      // treat ETF + Stock as "stocks" group
      return investments.filter((inv) => inv.type !== "Crypto");
    }
    return investments;
  }, [investments, chartFilter]);

  const pieData = filteredInvestments.map((i) => ({
    name: i.name,
    value: i.currentValue,
    color: i.color,
  }));

  // simple synthetic growth data that scales with selected group total
  const lineData = useMemo(() => {
    const total = filteredInvestments.reduce(
      (sum, inv) => sum + inv.currentValue,
      0
    );
    const base = total || 0;
    return [
      { month: "Jun", value: Math.round(base * 0.82) },
      { month: "Jul", value: Math.round(base * 0.88) },
      { month: "Aug", value: Math.round(base * 0.93) },
      { month: "Sep", value: Math.round(base * 0.97) },
      { month: "Oct", value: Math.round(base) },
    ];
  }, [filteredInvestments]);

  // ⭐ Watchlist handling
  const addToWatchlist = (asset) => {
    if (!watchlist.find((a) => a.symbol === asset.symbol)) {
      setWatchlist([...watchlist, asset]);
    }
  };

  // ⚙️ Handlers for portfolio controls
  const handleDividendChange = (id, freq) => {
    setInvestments((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, dividendFrequency: freq } : inv
      )
    );
  };

  const handleAutoToggle = (id) => {
    setInvestments((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? { ...inv, autoInvestEnabled: !inv.autoInvestEnabled }
          : inv
      )
    );
  };

  const handleAutoAmountChange = (id, amount) => {
    const value = Number(amount) || 0;
    setInvestments((prev) =>
      prev.map((inv) =>
        inv.id === id ? { ...inv, autoInvestAmount: value } : inv
      )
    );
  };

  const handleWithdraw = (id) => {
    const investment = investments.find((i) => i.id === id);
    if (!investment) return;

    const input = window.prompt(
      `Withdraw amount from ${
        investment.name
      } (current value RM ${investment.currentValue.toFixed(2)})`,
      "500"
    );
    if (!input) return;

    const amount = Number(input);
    if (!amount || amount <= 0) return;
    if (amount > investment.currentValue) {
      alert("Amount cannot be more than current value.");
      return;
    }

    // Update portfolio (prototype logic: reduce current value)
    setInvestments((prev) =>
      prev.map((inv) =>
        inv.id === id
          ? {
              ...inv,
              currentValue: inv.currentValue - amount,
              invested: Math.max(inv.invested - amount, 0),
            }
          : inv
      )
    );

    // Log activity
    setActivityLog((prev) => [
      {
        id: prev.length + 1,
        date: new Date().toISOString().slice(0, 10),
        type: "Withdraw",
        asset: investment.symbol,
        amount,
        status: "Completed",
      },
      ...prev,
    ]);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#eef3ff] to-[#e5edff] px-6 md:px-12 py-10 font-inter">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-4xl font-bold text-[#0b1222]">
            Investment Dashboard
          </h1>
          <p className="text-gray-600 text-lg mt-1">
            Track your portfolio, automate contributions, and explore the
            markets.
          </p>
        </div>

        <div className="mt-5 md:mt-0 flex flex-wrap gap-3 bg-white/70 border border-gray-200 rounded-xl shadow-sm p-1">
          <button
            className={`px-5 py-2 rounded-lg font-medium transition ${
              activeTab === "portfolio"
                ? "bg-gradient-to-r from-blue-500 to-sky-600 text-white"
                : "text-gray-700 hover:text-blue-600"
            }`}
            onClick={() => setActiveTab("portfolio")}
          >
            My Portfolio
          </button>
          <button
            className={`px-5 py-2 rounded-lg font-medium transition ${
              activeTab === "market"
                ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white"
                : "text-gray-700 hover:text-emerald-600"
            }`}
            onClick={() => setActiveTab("market")}
          >
            Market Overview
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="px-5 py-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-medium hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4 inline mr-1" /> Add Investment
          </button>
        </div>
      </header>

      {activeTab === "portfolio" ? (
        <>
          {/* Summary */}
          <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <SummaryCard
              label="Total Invested"
              value={`RM ${totals.invested.toLocaleString()}`}
              color="text-blue-600"
              icon={<DollarSign className="w-5 h-5 text-blue-600" />}
            />
            <SummaryCard
              label="Current Value"
              value={`RM ${totals.value.toLocaleString()}`}
              color="text-emerald-600"
              icon={<BarChart2 className="w-5 h-5 text-emerald-600" />}
            />
            <SummaryCard
              label="Profit / Loss"
              value={`RM ${totals.profit.toLocaleString()}`}
              color={totals.profit >= 0 ? "text-emerald-600" : "text-red-600"}
              icon={
                totals.profit >= 0 ? (
                  <ArrowUpCircle className="w-5 h-5 text-emerald-600" />
                ) : (
                  <ArrowDownCircle className="w-5 h-5 text-red-600" />
                )
              }
            />
            <SummaryCard
              label="ROI"
              value={`${totals.roi}%`}
              color="text-violet-600"
              icon={<TrendingUp className="w-5 h-5 text-violet-600" />}
            />
          </section>

          {/* Charts + filter */}
          <section className="mb-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
              <h2 className="text-2xl font-semibold text-[#0b1222]">
                Portfolio Insights
              </h2>
              <div className="mt-3 md:mt-0 inline-flex bg-slate-100 rounded-full p-1 text-xs font-medium text-gray-600">
                <button
                  className={`px-3 py-1 rounded-full ${
                    chartFilter === "all"
                      ? "bg-white shadow-sm text-sky-600"
                      : "hover:text-sky-600"
                  }`}
                  onClick={() => setChartFilter("all")}
                >
                  All
                </button>
                <button
                  className={`px-3 py-1 rounded-full ${
                    chartFilter === "stock"
                      ? "bg-white shadow-sm text-sky-600"
                      : "hover:text-sky-600"
                  }`}
                  onClick={() => setChartFilter("stock")}
                >
                  Stocks / ETF
                </button>
                <button
                  className={`px-3 py-1 rounded-full ${
                    chartFilter === "crypto"
                      ? "bg-white shadow-sm text-sky-600"
                      : "hover:text-sky-600"
                  }`}
                  onClick={() => setChartFilter("crypto")}
                >
                  Crypto
                </button>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              <ChartCard
                title="Portfolio Distribution"
                icon={<PieChart />}
                chartType="pie"
                data={pieData}
              />
              <ChartCard
                title="Portfolio Growth Over Time"
                icon={<LineChart />}
                chartType="line"
                data={lineData}
              />
            </div>
          </section>

          {/* My Investments */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-[#0b1222] mb-4">
              My Investments
            </h2>
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {investments.map((inv) => (
                <InvestmentCard
                  key={inv.id}
                  investment={inv}
                  onDividendChange={handleDividendChange}
                  onAutoToggle={handleAutoToggle}
                  onAutoAmountChange={handleAutoAmountChange}
                  onWithdraw={handleWithdraw}
                />
              ))}
            </div>
          </section>

          {/* Watchlist */}
          {watchlist.length > 0 && (
            <section className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 mb-10 shadow-lg">
              <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[#0b1222]">
                <Star className="w-5 h-5 text-amber-500" /> Watchlist
              </h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {watchlist.map((asset) => (
                  <div
                    key={asset.symbol}
                    className="bg-gradient-to-br from-white to-sky-50 border border-gray-100 rounded-xl p-5 shadow-sm"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-lg text-gray-800">
                        {asset.name}
                      </h3>
                      <span className="text-sm font-medium text-sky-600">
                        {asset.type}
                      </span>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Price: ${asset.price.toLocaleString()}
                    </p>
                    <p
                      className={`font-medium ${
                        asset.change >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {asset.change >= 0 ? "+" : ""}
                      {asset.change}%
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Activity Log */}
          <section className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-[#0b1222]">
              Activity Log
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th className="py-2">Date</th>
                  <th className="py-2">Type</th>
                  <th className="py-2">Asset</th>
                  <th className="py-2">Amount (RM)</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {activityLog.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 text-sm hover:bg-sky-50/40"
                  >
                    <td className="py-2 text-gray-600">{log.date}</td>
                    <td
                      className={`py-2 font-medium ${
                        log.type === "Withdraw"
                          ? "text-red-600"
                          : log.type === "Dividend"
                          ? "text-amber-600"
                          : "text-emerald-600"
                      }`}
                    >
                      {log.type}
                    </td>
                    <td className="py-2 text-gray-700">{log.asset}</td>
                    <td className="py-2 text-gray-700">
                      {log.amount.toLocaleString()}
                    </td>
                    <td className="py-2 text-gray-500">{log.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : (
        <>
          {/* Market Overview */}
          <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 mb-10 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2 text-[#0b1222]">
              <Globe className="w-5 h-5 text-emerald-600" /> Market Overview
            </h2>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 text-sm">
                  <th>Name</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th>Price (USD)</th>
                  <th>24h</th>
                  <th>Market Cap</th>
                  <th className="text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {market.map((m, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-100 hover:bg-sky-50 transition"
                  >
                    <td className="py-3 font-medium text-gray-700">{m.name}</td>
                    <td className="py-3 text-gray-500">{m.symbol}</td>
                    <td>
                      <span
                        className={`px-3 py-1 text-sm rounded-full font-medium ${
                          m.type === "Stock"
                            ? "bg-blue-100 text-blue-700"
                            : m.type === "ETF"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {m.type}
                      </span>
                    </td>
                    <td className="text-gray-700">
                      ${m.price.toLocaleString()}
                    </td>
                    <td
                      className={`font-medium ${
                        m.change >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {m.change >= 0 ? "+" : ""}
                      {m.change}%
                    </td>
                    <td className="text-gray-500">{m.marketCap}</td>
                    <td className="text-center">
                      <button
                        onClick={() => addToWatchlist(m)}
                        className="px-3 py-1 rounded-lg bg-gradient-to-r from-blue-500 to-sky-600 text-white text-sm font-medium hover:opacity-90 transition"
                      >
                        <Star className="w-4 h-4 inline mr-1" /> Watch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {showModal && <AddInvestmentModal onClose={() => setShowModal(false)} />}
    </main>
  );
}

/* --- Reusable components --- */

const SummaryCard = ({ label, value, color, icon }) => (
  <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
    <div className="flex justify-between items-center">
      <p className="text-gray-500 text-sm">{label}</p>
      {icon}
    </div>
    <h2 className={`text-2xl font-semibold mt-1 ${color}`}>{value}</h2>
  </div>
);

const ChartCard = ({ title, icon, chartType, data }) => (
  <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 shadow-md hover:shadow-lg transition">
    <h2 className="text-2xl font-semibold text-[#0b1222] mb-4 flex items-center gap-2">
      {icon} {title}
    </h2>
    <div className="h-[320px]">
      <ResponsiveContainer width="100%" height="100%">
        {chartType === "pie" ? (
          <RePieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              outerRadius={110}
              label
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </RePieChart>
        ) : (
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="month" stroke="#64748b" />
            <YAxis stroke="#94a3b8" />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#0ea5e9"
              strokeWidth={3}
              dot={{ fill: "#0ea5e9" }}
            />
          </ComposedChart>
        )}
      </ResponsiveContainer>
    </div>
  </div>
);

const InvestmentCard = ({
  investment,
  onDividendChange,
  onAutoToggle,
  onAutoAmountChange,
  onWithdraw,
}) => {
  const roiColor = investment.change >= 0 ? "text-emerald-600" : "text-red-600";

  return (
    <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-md p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${investment.color}20` }}
          >
            {investment.type === "Crypto" ? (
              <Bitcoin
                className="w-5 h-5"
                style={{ color: investment.color }}
              />
            ) : (
              <TrendingUp
                className="w-5 h-5"
                style={{ color: investment.color }}
              />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[#0b1222]">
              {investment.name}
            </h3>
            <p className="text-xs text-gray-500 uppercase">
              {investment.symbol} • {investment.type}
            </p>
          </div>
        </div>
        <span className={`text-sm font-medium ${roiColor}`}>
          {investment.change >= 0 ? "+" : ""}
          {investment.change}% ROI
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
        <div>
          <p className="text-gray-500">Current value</p>
          <p className="text-base font-semibold text-gray-800">
            RM {investment.currentValue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Invested</p>
          <p className="text-base font-semibold text-gray-800">
            RM {investment.invested.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Units</p>
          <p className="text-base font-semibold text-gray-800">
            {investment.units}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Avg. buy price</p>
          <p className="text-base font-semibold text-gray-800">
            {investment.type === "Crypto" ? "$" : "RM "}
            {investment.avgPrice.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Dividend + Automation section */}
      <div className="border-t border-gray-100 pt-4 space-y-3 text-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Dividend setting:</span>
            <select
              value={investment.dividendFrequency}
              onChange={(e) => onDividendChange(investment.id, e.target.value)}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            >
              <option value="none">None</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          {investment.dividendYield > 0 && (
            <p className="text-gray-500">
              Approx. yield:{" "}
              <span className="font-medium text-emerald-600">
                {(investment.dividendYield * 100).toFixed(1)}% / year
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={investment.autoInvestEnabled}
              onChange={() => onAutoToggle(investment.id)}
              className="w-4 h-4 accent-sky-500"
            />
            <span className="text-gray-700">
              Auto-invest monthly into this asset
            </span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-gray-500 text-sm">Amount:</span>
            <input
              type="number"
              min={0}
              value={investment.autoInvestAmount}
              onChange={(e) =>
                onAutoAmountChange(investment.id, e.target.value)
              }
              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-sky-400"
            />
            <span className="text-gray-500 text-xs">RM / month</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={() => onWithdraw(investment.id)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-medium hover:opacity-90 transition"
          >
            Withdraw / Sell
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-1">
          Settings above are for prototype behaviour only — in production these
          would be connected to your Node.js API & broker integrations.
        </p>
      </div>
    </div>
  );
};
