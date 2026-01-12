import { useState, useMemo } from "react";
import {
  Plus,
  PiggyBank,
  TrendingUp,
  RefreshCw,
  Settings,
  Pencil,
  MinusCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  Trophy,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function SavingsPage() {
  const [editing, setEditing] = useState(null);
  const [withdrawing, setWithdrawing] = useState(null);
  const [view, setView] = useState("monthly");

  const [savings, setSavings] = useState([
    {
      id: 1,
      account: "ASB",
      color: "#0ea5e9",
      type: "manual",
      autoSave: true,
      autoAmount: 200,
      capital: 5200,
      dividend: 350,
      goal: 10000,
      history: [
        { type: "deposit", amount: 200, date: "2025-11-01" },
        { type: "auto", amount: 200, date: "2025-10-01" },
        { type: "withdraw", amount: 100, date: "2025-09-10" },
      ],
    },
    {
      id: 2,
      account: "Versa-i",
      color: "#22c55e",
      type: "api",
      autoSave: false,
      autoAmount: 0,
      capital: 2100,
      dividend: 120,
      goal: 5000,
      history: [
        { type: "auto", amount: 100, date: "2025-11-10" },
        { type: "dividend", amount: 20, date: "2025-11-09" },
      ],
    },
    {
      id: 3,
      account: "Touch ‘n Go GO+",
      color: "#f59e0b",
      type: "api",
      autoSave: true,
      autoAmount: 100,
      capital: 1600,
      dividend: 60,
      goal: 3000,
      history: [
        { type: "auto", amount: 100, date: "2025-11-02" },
        { type: "dividend", amount: 3, date: "2025-11-11" },
      ],
    },
  ]);

  const totals = useMemo(() => {
    const capital = savings.reduce((a, b) => a + b.capital, 0);
    const dividend = savings.reduce((a, b) => a + b.dividend, 0);
    return {
      capital,
      dividend,
      total: capital + dividend,
      roi: ((dividend / capital) * 100).toFixed(2),
    };
  }, [savings]);

  const toggleAutoSave = (id) => {
    setSavings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, autoSave: !s.autoSave } : s))
    );
  };

  const handleEdit = (account) => setEditing(account);
  const handleWithdraw = (account) => setWithdrawing(account);

  const saveEdit = () => {
    if (!editing) return;
    setSavings((prev) => prev.map((s) => (s.id === editing.id ? editing : s)));
    setEditing(null);
  };

  const saveWithdraw = () => {
    if (!withdrawing) return;
    const amount = parseFloat(withdrawing.amount);
    if (isNaN(amount) || amount <= 0) return alert("Invalid amount");
    setSavings((prev) =>
      prev.map((s) =>
        s.id === withdrawing.id
          ? {
              ...s,
              capital: s.capital - amount,
              history: [
                ...s.history,
                { type: "withdraw", amount, date: new Date().toISOString() },
              ],
            }
          : s
      )
    );
    setWithdrawing(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf4ff] to-[#e5edff] px-6 md:px-12 py-10 font-inter overflow-hidden">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-4xl font-bold text-[#0b1222]">Savings Tracker</h1>
          <p className="text-gray-600 text-lg mt-1">
            Refined, clear, and automated — track your real-world savings
            growth.
          </p>
        </div>
        <button
          onClick={() => alert("Add account feature coming soon")}
          className="mt-4 md:mt-0 flex items-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.03] transition"
        >
          <Plus className="w-4 h-4" /> Add Account
        </button>
      </header>

      {/* Summary Cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <SummaryCard
          label="Total Capital"
          color="text-sky-600"
          value={totals.capital}
        />
        <SummaryCard
          label="Total Dividends"
          color="text-emerald-600"
          value={totals.dividend}
        />
        <SummaryCard
          label="Total Value"
          color="text-indigo-600"
          value={totals.total}
        />
        <SummaryCard
          label="ROI"
          color="text-violet-600"
          value={`${totals.roi}%`}
        />
      </section>

      {/* Smart Insight */}
      <div className="bg-gradient-to-r from-sky-50 to-blue-100 rounded-xl p-5 mb-10 border border-blue-200 shadow-sm">
        <p className="text-gray-700 text-sm leading-relaxed">
          💡 <strong>Insight:</strong> You’ve reached{" "}
          <span className="text-blue-600 font-semibold">
            {((totals.capital / 15000) * 100).toFixed(1)}%
          </span>{" "}
          of your total savings goal — steady growth ahead!
        </p>
      </div>

      {/* Chart Section */}
      <section className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 mb-12 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-[#0b1222] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" /> Growth Overview
          </h2>
          <div className="flex gap-2">
            {["monthly", "yearly"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1 rounded-lg text-sm font-medium transition ${
                  view === v
                    ? "bg-gradient-to-r from-blue-500 to-sky-600 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={[
                { month: "Jun", ASB: 4800, Versa: 1900, TNG: 1300 },
                { month: "Jul", ASB: 5000, Versa: 1950, TNG: 1400 },
                { month: "Aug", ASB: 5200, Versa: 2000, TNG: 1500 },
                { month: "Sep", ASB: 5400, Versa: 2050, TNG: 1550 },
                { month: "Oct", ASB: 5600, Versa: 2100, TNG: 1600 },
              ]}
            >
              <defs>
                <linearGradient id="colorASB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorVersa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="colorTNG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.1} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="month" stroke="#64748b" />
              <YAxis stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="ASB"
                stroke="#0ea5e9"
                fill="url(#colorASB)"
              />
              <Area
                type="monotone"
                dataKey="Versa"
                stroke="#22c55e"
                fill="url(#colorVersa)"
              />
              <Area
                type="monotone"
                dataKey="TNG"
                stroke="#f59e0b"
                fill="url(#colorTNG)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Accounts */}
      <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {savings.map((s) => (
          <SavingsCard
            key={s.id}
            s={s}
            onEdit={() => handleEdit(s)}
            onWithdraw={() => handleWithdraw(s)}
            toggleAutoSave={() => toggleAutoSave(s.id)}
          />
        ))}
      </section>

      {/* Edit Modal */}
      {editing && (
        <Modal
          title={`Edit ${editing.account}`}
          onClose={() => setEditing(null)}
        >
          <label className="block text-sm text-gray-600 mt-2">
            Capital (RM)
            <input
              type="number"
              value={editing.capital}
              onChange={(e) =>
                setEditing({ ...editing, capital: parseFloat(e.target.value) })
              }
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <label className="block text-sm text-gray-600 mt-2">
            Auto Save (RM/month)
            <input
              type="number"
              value={editing.autoAmount}
              onChange={(e) =>
                setEditing({
                  ...editing,
                  autoAmount: parseFloat(e.target.value),
                })
              }
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <button
            onClick={saveEdit}
            className="mt-4 bg-gradient-to-r from-blue-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition"
          >
            Save Changes
          </button>
        </Modal>
      )}

      {/* Withdraw Modal */}
      {withdrawing && (
        <Modal
          title={`Withdraw from ${withdrawing.account}`}
          onClose={() => setWithdrawing(null)}
        >
          <label className="block text-sm text-gray-600">
            Amount to Withdraw (RM)
            <input
              type="number"
              onChange={(e) =>
                setWithdrawing({ ...withdrawing, amount: e.target.value })
              }
              className="mt-1 w-full border rounded-lg px-3 py-2"
            />
          </label>
          <button
            onClick={saveWithdraw}
            className="mt-4 bg-gradient-to-r from-red-500 to-rose-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition"
          >
            Confirm Withdraw
          </button>
        </Modal>
      )}
    </main>
  );
}

/* Components */
const SummaryCard = ({ label, color, value }) => (
  <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
    <p className="text-gray-500 text-sm">{label}</p>
    <h2 className={`text-2xl font-semibold ${color}`}>RM {value}</h2>
  </div>
);

const SavingsCard = ({ s, onEdit, onWithdraw, toggleAutoSave }) => (
  <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-md p-6 hover:shadow-lg transition">
    <div className="flex justify-between items-center mb-4">
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${s.color}25` }}
        >
          <PiggyBank className="w-5 h-5" style={{ color: s.color }} />
        </div>
        <h3 className="text-lg font-semibold text-[#0b1222]">{s.account}</h3>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="p-2 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 transition"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onWithdraw}
          className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition"
        >
          <MinusCircle className="w-4 h-4" />
        </button>
      </div>
    </div>

    {/* Stats */}
    <div className="space-y-3 mb-3">
      <p className="text-sm text-gray-500">Capital</p>
      <h4 className="text-xl font-semibold text-blue-600">
        RM {s.capital.toFixed(2)}
      </h4>
      <p className="text-sm text-gray-500">Dividends</p>
      <h4 className="text-xl font-semibold text-emerald-600">
        RM {s.dividend.toFixed(2)}
      </h4>
      <p className="text-sm text-gray-500">Goal Progress</p>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="h-2 bg-gradient-to-r from-blue-400 to-sky-600 rounded-full"
          style={{ width: `${Math.min((s.capital / s.goal) * 100, 100)}%` }}
        ></div>
      </div>
      <p className="text-xs text-gray-500 text-right">
        {((s.capital / s.goal) * 100).toFixed(1)}% of RM{s.goal}
      </p>
    </div>

    {/* Automation */}
    <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
      <div className="flex items-center gap-2 text-gray-500">
        <Settings className="w-4 h-4" /> Auto Save
      </div>
      <button
        onClick={toggleAutoSave}
        className={`px-3 py-1 rounded-lg text-sm font-medium ${
          s.autoSave
            ? "bg-emerald-100 text-emerald-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {s.autoSave ? "ON" : "OFF"}
      </button>
    </div>

    {/* Transaction History */}
    <div className="mt-4 border-t pt-3">
      <p className="text-sm font-medium text-gray-600 mb-2">Recent Activity</p>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {s.history.length > 0 ? (
          s.history.map((h, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span
                className={`flex items-center gap-1 ${
                  h.type === "withdraw"
                    ? "text-rose-500"
                    : h.type === "dividend"
                    ? "text-emerald-600"
                    : "text-blue-600"
                }`}
              >
                {h.type === "withdraw" && (
                  <ArrowDownCircle className="w-3 h-3" />
                )}
                {h.type === "deposit" && <ArrowUpCircle className="w-3 h-3" />}
                {h.type === "dividend" && <Trophy className="w-3 h-3" />}
                {h.type === "auto" && <RefreshCw className="w-3 h-3" />}
                {h.type.charAt(0).toUpperCase() + h.type.slice(1)}
              </span>
              <span>RM {h.amount}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-gray-400">No recent activity</p>
        )}
      </div>
    </div>
  </div>
);

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 animate-fadeIn">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
          ✕
        </button>
      </div>
      {children}
    </div>
  </div>
);
