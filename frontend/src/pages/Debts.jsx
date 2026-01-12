import { useState, useMemo } from "react";
import { Banknote, CalendarDays, TrendingUp, Plus, Wallet } from "lucide-react";
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

export default function DebtsPage() {
  const [showAddModal, setShowAddModal] = useState(false);

  // COLORS FOR DEBT CATEGORY TAGS
  const CATEGORY_COLOR = {
    "Car Loan": "#2563eb",
    "House Loan": "#7c3aed",
    "Education Loan (PTPTN)": "#10b981",
    BNPL: "#fb923c",
    "Credit Card": "#ef4444",
    "Personal Loan": "#6b7280",
  };

  // DEBTS DATA
  const [loans, setLoans] = useState([
    {
      id: 1,
      category: "Car Loan",
      type: "Perodua Myvi Loan",
      lender: "Public Bank",
      amount: 42000,
      balance: 31800,
      monthly: 520,
      interest: 3.1,
      start: "2024-01-01",
      end: "2029-01-01",
      nextPayment: "2025-02-08",
      color: CATEGORY_COLOR["Car Loan"],
      history: [
        { date: "2025-01-08", amount: 520 },
        { date: "2024-12-08", amount: 520 },
      ],
    },
    {
      id: 2,
      category: "House Loan",
      type: "Mortgage - Apartment",
      lender: "Maybank",
      amount: 260000,
      balance: 247400,
      monthly: 1250,
      interest: 3.9,
      start: "2023-04-01",
      end: "2043-04-01",
      nextPayment: "2025-02-01",
      color: CATEGORY_COLOR["House Loan"],
      history: [{ date: "2025-01-01", amount: 1250 }],
    },
    {
      id: 3,
      category: "Education Loan (PTPTN)",
      type: "PTPTN",
      lender: "PTPTN",
      amount: 15000,
      balance: 13877,
      monthly: 150,
      interest: 1,
      start: "2023-07-01",
      end: "2033-07-01",
      nextPayment: "2025-02-01",
      color: CATEGORY_COLOR["Education Loan (PTPTN)"],
      history: [{ date: "2025-01-05", amount: 150 }],
    },
    {
      id: 4,
      category: "BNPL",
      type: "Shopee SPayLater",
      lender: "Shopee",
      amount: 1200,
      balance: 450,
      monthly: 150,
      interest: 1.5,
      start: "2024-11-01",
      end: "2025-05-01",
      nextPayment: "2025-02-15",
      color: CATEGORY_COLOR["BNPL"],
      history: [{ date: "2025-01-15", amount: 150 }],
    },
    {
      id: 5,
      category: "Credit Card",
      type: "Maybank Visa Credit Card",
      lender: "Maybank",
      amount: 2300,
      balance: 950,
      monthly: 200,
      interest: 18,
      start: "2024-01-01",
      end: "2025-01-01",
      nextPayment: "2025-02-03",
      color: CATEGORY_COLOR["Credit Card"],
      history: [
        { date: "2025-01-02", amount: 300 },
        { date: "2024-12-05", amount: 200 },
      ],
    },
  ]);

  // ============= ANALYTICS =============
  const totals = useMemo(() => {
    const original = loans.reduce((a, l) => a + l.amount, 0);
    const remaining = loans.reduce((a, l) => a + l.balance, 0);
    const monthly = loans.reduce((a, l) => a + l.monthly, 0);
    const paid = original - remaining;

    return {
      original,
      remaining,
      monthly,
      paid,
      progress: ((paid / original) * 100).toFixed(1),
    };
  }, [loans]);

  const pieData = loans.map((l) => ({
    name: `${l.category} (${l.type})`,
    value: l.balance,
    color: l.color,
  }));

  const monthlyPayments = loans.map((l) => ({
    name: l.category,
    monthly: l.monthly,
    color: l.color,
  }));

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf2ff] to-[#e0eaff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-[#0b1222]">Debt Manager</h1>
        <p className="text-gray-600 text-lg">
          Track car loans, house loans, BNPL, PTPTN, and all your commitments in
          one place.
        </p>
      </header>

      {/* SUMMARY CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        <SummaryCard
          label="Total Loan Amount"
          value={`RM ${totals.original.toLocaleString()}`}
          icon={<Banknote className="w-5 h-5 text-blue-500" />}
          color="text-blue-600"
        />
        <SummaryCard
          label="Remaining Balance"
          value={`RM ${totals.remaining.toLocaleString()}`}
          icon={<Wallet className="w-5 h-5 text-rose-500" />}
          color="text-rose-600"
        />
        <SummaryCard
          label="Total Monthly Commitments"
          value={`RM ${totals.monthly.toLocaleString()}`}
          icon={<CalendarDays className="w-5 h-5 text-green-600" />}
          color="text-green-600"
        />
        <SummaryCard
          label="Overall Progress"
          value={`${totals.progress}%`}
          icon={<TrendingUp className="w-5 h-5 text-indigo-500" />}
          color="text-indigo-600"
        />
      </section>

      {/* CHARTS */}
      <div className="grid lg:grid-cols-2 gap-8 mb-14">
        <ChartCard title="Debt Distribution" type="pie" data={pieData} />
        <ChartCard
          title="Monthly Payments Breakdown"
          type="bar"
          data={monthlyPayments}
        />
      </div>

      {/* LOAN LIST */}
      <section className="mb-14">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-[#0b1222]">My Debts</h2>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-sky-600 text-white font-medium flex items-center gap-2 hover:opacity-90 transition"
          >
            <Plus className="w-4 h-4" /> Add New Debt
          </button>
        </div>

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
          {loans.map((loan) => (
            <LoanCard key={loan.id} loan={loan} />
          ))}
        </div>
      </section>

      {/* ADD LOAN MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              Add New Debt
            </h2>

            <AddDebtForm
              onCancel={() => setShowAddModal(false)}
              onSave={(newDebt) => {
                const selectedColor =
                  CATEGORY_COLOR[newDebt.category] || "#0ea5e9";

                const created = {
                  ...newDebt,
                  id: loans.length + 1,
                  color: selectedColor,
                  history: [],
                };

                setLoans((prev) => [...prev, created]);
                setShowAddModal(false);
              }}
            />
          </div>
        </div>
      )}
    </main>
  );
}

/* COMPONENTS ------------------------------------------------------------------------------------ */

const SummaryCard = ({ label, value, icon, color }) => (
  <div className="bg-white/80 backdrop-blur-lg border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
    <div className="flex justify-between items-center">
      <p className="text-gray-500 text-sm">{label}</p>
      {icon}
    </div>
    <h3 className={`text-2xl font-semibold mt-1 ${color}`}>{value}</h3>
  </div>
);

const ChartCard = ({ title, type, data }) => (
  <div className="bg-white/90 backdrop-blur-md rounded-2xl p-6 border border-gray-100 shadow-md hover:shadow-lg transition">
    <h3 className="text-xl font-semibold text-[#0b1222] mb-3">{title}</h3>
    <div className="h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        {type === "pie" ? (
          <PieChart>
            <Pie data={data} dataKey="value" outerRadius={100} label>
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="monthly">
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  </div>
);

const LoanCard = ({ loan }) => {
  const paidPercent = (
    ((loan.amount - loan.balance) / loan.amount) *
    100
  ).toFixed(1);

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 border border-gray-200 shadow-md hover:shadow-lg transition">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-lg">{loan.type}</h3>
        <span
          className="text-xs px-2 py-1 rounded-full text-white"
          style={{ background: loan.color }}
        >
          {loan.category}
        </span>
      </div>

      <p className="text-gray-600 text-sm">{loan.lender}</p>

      <div className="grid grid-cols-2 gap-4 text-sm mt-4">
        <div>
          <p className="text-gray-500">Remaining</p>
          <p className="font-semibold text-gray-800">
            RM {loan.balance.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Monthly</p>
          <p className="font-semibold text-gray-800">
            RM {loan.monthly.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Interest</p>
          <p className="font-semibold text-gray-800">{loan.interest}%</p>
        </div>
        <div>
          <p className="text-gray-500">Next Payment</p>
          <p className="font-semibold text-gray-800">{loan.nextPayment}</p>
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div className="mt-4">
        <p className="text-gray-500 text-xs mb-1">Progress: {paidPercent}%</p>
        <div className="w-full bg-gray-200 h-2 rounded-full">
          <div
            className="h-full rounded-full"
            style={{ width: `${paidPercent}%`, background: loan.color }}
          ></div>
        </div>
      </div>
    </div>
  );
};

const AddDebtForm = ({ onCancel, onSave }) => {
  const [form, setForm] = useState({
    category: "Car Loan",
    type: "",
    lender: "",
    amount: "",
    balance: "",
    monthly: "",
    interest: "",
    start: "",
    end: "",
    nextPayment: "",
  });

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-4">
      {/* Category */}
      <div>
        <label className="text-gray-600 text-sm">Category</label>
        <select
          className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-400"
          value={form.category}
          onChange={(e) => update("category", e.target.value)}
        >
          <option>Car Loan</option>
          <option>House Loan</option>
          <option>Education Loan (PTPTN)</option>
          <option>BNPL</option>
          <option>Credit Card</option>
          <option>Personal Loan</option>
        </select>
      </div>

      {/* Type */}
      <div>
        <label className="text-gray-600 text-sm">Loan Type</label>
        <input
          type="text"
          placeholder="Eg: Myvi Loan / SPayLater / PTPTN"
          className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-sky-400"
          value={form.type}
          onChange={(e) => update("type", e.target.value)}
        />
      </div>

      {/* Lender */}
      <div>
        <label className="text-gray-600 text-sm">Lender</label>
        <input
          type="text"
          placeholder="Maybank, Shopee, PTPTN, etc."
          className="w-full mt-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-sky-400"
          value={form.lender}
          onChange={(e) => update("lender", e.target.value)}
        />
      </div>

      {/* Amount */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-600 text-sm">Loan Amount (RM)</label>
          <input
            type="number"
            className="w-full mt-1 px-3 py-2 border rounded-lg"
            value={form.amount}
            onChange={(e) => update("amount", Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-gray-600 text-sm">
            Remaining Balance (RM)
          </label>
          <input
            type="number"
            className="w-full mt-1 px-3 py-2 border rounded-lg"
            value={form.balance}
            onChange={(e) => update("balance", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Monthly + Interest */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-600 text-sm">Monthly Payment (RM)</label>
          <input
            type="number"
            className="w-full mt-1 px-3 py-2 border rounded-lg"
            value={form.monthly}
            onChange={(e) => update("monthly", Number(e.target.value))}
          />
        </div>

        <div>
          <label className="text-gray-600 text-sm">Interest Rate (%)</label>
          <input
            type="number"
            className="w-full mt-1 px-3 py-2 border rounded-lg"
            value={form.interest}
            onChange={(e) => update("interest", Number(e.target.value))}
          />
        </div>
      </div>

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-gray-600 text-sm">Start Date</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 border rounded-lg"
            value={form.start}
            onChange={(e) => update("start", e.target.value)}
          />
        </div>

        <div>
          <label className="text-gray-600 text-sm">End Date</label>
          <input
            type="date"
            className="w-full mt-1 px-3 py-2 border rounded-lg"
            value={form.end}
            onChange={(e) => update("end", e.target.value)}
          />
        </div>
      </div>

      {/* Next Payment */}
      <div>
        <label className="text-gray-600 text-sm">Next Payment Date</label>
        <input
          type="date"
          className="w-full mt-1 px-3 py-2 border rounded-lg"
          value={form.nextPayment}
          onChange={(e) => update("nextPayment", e.target.value)}
        />
      </div>

      {/* Buttons */}
      <div className="pt-4 flex justify-end gap-3">
        <button
          className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          className="px-4 py-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white rounded-lg hover:opacity-90"
          onClick={() => {
            if (!form.type || !form.lender) return;
            onSave(form);
          }}
        >
          Save Debt
        </button>
      </div>
    </div>
  );
};
