import { useState, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

export default function Expenses() {
  /* -------------------------------------------------------------------------- */
  /*                                Demo Data                                   */
  /* -------------------------------------------------------------------------- */

  const [transactions, setTransactions] = useState([
    {
      id: 1,
      type: "Expense",
      category: "Food",
      amount: 25.5,
      note: "Lunch",
      date: "2025-11-10",
    },
    {
      id: 2,
      type: "Income",
      category: "Freelance",
      amount: 3800,
      note: "Web Design Project",
      date: "2025-11-09",
    },
    {
      id: 3,
      type: "Expense",
      category: "Transport",
      amount: 10,
      note: "Grab Ride",
      date: "2025-11-08",
    },
  ]);

  const categories = [
    "Food",
    "Transport",
    "Shopping",
    "Bills",
    "Entertainment",
    "Freelance",
    "Salary",
  ];

  const COLORS = [
    "#0284c7",
    "#0ea5e9",
    "#38bdf8",
    "#7dd3fc",
    "#0369a1",
    "#0c4a6e",
  ];

  /* -------------------------------------------------------------------------- */
  /*                              Form Handling                                 */
  /* -------------------------------------------------------------------------- */

  const [form, setForm] = useState({
    type: "Expense",
    category: "",
    amount: "",
    note: "",
    date: "",
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || !form.category || !form.date)
      return alert("Please fill all fields");

    if (isEditing) {
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? { ...t, ...form, amount: Number(form.amount) }
            : t
        )
      );
      setIsEditing(false);
      setEditingId(null);
    } else {
      const newTransaction = {
        id: Date.now(),
        ...form,
        amount: parseFloat(form.amount),
      };
      setTransactions([...transactions, newTransaction]);
    }

    setForm({
      type: "Expense",
      category: "",
      amount: "",
      note: "",
      date: "",
    });
  };

  const handleDelete = (id) =>
    setTransactions(transactions.filter((t) => t.id !== id));

  const handleEdit = (t) => {
    setForm({
      type: t.type,
      category: t.category,
      amount: t.amount,
      note: t.note,
      date: t.date,
    });
    setEditingId(t.id);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* -------------------------------------------------------------------------- */
  /*                               Filters                                      */
  /* -------------------------------------------------------------------------- */

  const [filterType, setFilterType] = useState("All");
  const [filterMonth, setFilterMonth] = useState("2025-11");
  const [filterCategory, setFilterCategory] = useState("All");
  const [search, setSearch] = useState("");

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((t) => (filterType === "All" ? true : t.type === filterType))
      .filter((t) =>
        filterCategory === "All" ? true : t.category === filterCategory
      )
      .filter((t) => t.date.startsWith(filterMonth))
      .filter(
        (t) =>
          t.note.toLowerCase().includes(search.toLowerCase()) ||
          t.category.toLowerCase().includes(search.toLowerCase())
      );
  }, [transactions, filterType, filterMonth, filterCategory, search]);

  /* -------------------------------------------------------------------------- */
  /*                               Pagination                                   */
  /* -------------------------------------------------------------------------- */

  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  const paginated = filteredTransactions.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  /* -------------------------------------------------------------------------- */
  /*                            Summary Calculations                             */
  /* -------------------------------------------------------------------------- */

  const totalExpense = filteredTransactions
    .filter((t) => t.type === "Expense")
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = filteredTransactions
    .filter((t) => t.type === "Income")
    .reduce((sum, t) => sum + t.amount, 0);

  const lastMonthIncome = totalIncome * 0.92; // demo
  const lastMonthExpense = totalExpense * 1.05; // demo

  const netBalance = totalIncome - totalExpense;
  const lastMonthBalance = lastMonthIncome - lastMonthExpense;

  /* -------------------------------------------------------------------------- */
  /*                               Category Chart                               */
  /* -------------------------------------------------------------------------- */

  const categoryData = Object.values(
    filteredTransactions
      .filter((t) => t.type === "Expense")
      .reduce((acc, t) => {
        acc[t.category] = acc[t.category] || { name: t.category, value: 0 };
        acc[t.category].value += t.amount;
        return acc;
      }, {})
  );

  /* -------------------------------------------------------------------------- */
  /*                                   UI                                       */
  /* -------------------------------------------------------------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f8fbff] via-[#ecf2ff] to-[#dde9ff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-[#0b1222]">
          Expense & Income Tracker
        </h1>
        <p className="text-gray-600">
          Track, manage, and analyze your spending — all in one place.
        </p>
      </header>

      {/* THIS MONTH VS LAST MONTH */}
      <section className="mb-10 bg-white/90 backdrop-blur-lg p-6 rounded-2xl shadow border border-gray-200">
        <h2 className="text-lg font-semibold text-[#0b1222] mb-4">
          This Month vs Last Month
        </h2>

        <div className="grid sm:grid-cols-3 gap-6">
          {/* INCOME */}
          <StatComparison
            title="Income"
            current={totalIncome}
            last={lastMonthIncome}
            color="emerald"
          />

          {/* EXPENSE */}
          <StatComparison
            title="Expenses"
            current={totalExpense}
            last={lastMonthExpense}
            color="red"
          />

          {/* NET BALANCE */}
          <StatComparison
            title="Net Balance"
            current={netBalance}
            last={lastMonthBalance}
            color="sky"
          />
        </div>
      </section>

      {/* SUMMARY CARDS */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
        <SummaryCard label="Total Income" value={totalIncome} color="emerald" />
        <SummaryCard label="Total Expense" value={totalExpense} color="red" />
        <SummaryCard label="Net Balance" value={netBalance} color="sky" />
      </section>

      {/* FILTERS */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow border border-gray-200 mb-10">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4">Filters</h2>

        <div className="grid md:grid-cols-4 gap-4">
          {/* Filter Type */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="p-3 bg-white border border-gray-300 rounded-lg text-[#0b1222]"
          >
            <option>All</option>
            <option>Expense</option>
            <option>Income</option>
          </select>

          {/* Filter Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="p-3 bg-white border border-gray-300 rounded-lg text-[#0b1222]"
          >
            <option>All</option>
            {categories.map((c, i) => (
              <option key={i}>{c}</option>
            ))}
          </select>

          {/* Month Filter */}
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="p-3 bg-white border border-gray-300 rounded-lg text-[#0b1222]"
          />

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search note or category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 p-3 bg-white border border-gray-300 rounded-lg text-[#0b1222] placeholder-gray-400 w-full"
            />
          </div>
        </div>
      </section>

      {/* ADD / EDIT FORM */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow border border-gray-200 mb-10">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4 flex items-center gap-2">
          <Plus className="w-5 h-5 text-sky-500" />{" "}
          {isEditing ? "Edit Transaction" : "Add Transaction"}
        </h2>

        <form
          onSubmit={handleSubmit}
          className="grid md:grid-cols-5 gap-4 text-sm"
        >
          {/* TYPE */}
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="p-3 border border-gray-300 rounded-lg bg-white text-[#0b1222]"
          >
            <option>Expense</option>
            <option>Income</option>
          </select>

          {/* CATEGORY */}
          <input
            type="text"
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            className="p-3 border border-gray-300 rounded-lg bg-white text-[#0b1222] placeholder-gray-400"
          />

          {/* AMOUNT */}
          <input
            type="number"
            placeholder="Amount"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            className="p-3 border border-gray-300 rounded-lg bg-white text-[#0b1222] placeholder-gray-400"
          />

          {/* NOTE */}
          <input
            type="text"
            placeholder="Note"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            className="p-3 border border-gray-300 rounded-lg bg-white text-[#0b1222] placeholder-gray-400"
          />

          {/* DATE */}
          <input
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="p-3 border border-gray-300 rounded-lg bg-white text-[#0b1222]"
          />

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            className="md:col-span-5 bg-gradient-to-r from-sky-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:scale-[1.02] transition"
          >
            {isEditing ? "Update Transaction" : "Add Record"}
          </button>
        </form>
      </section>

      {/* PIE CHART */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow border border-gray-200 mb-10">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4">
          Expense Breakdown
        </h2>

        {categoryData.length > 0 ? (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={categoryData} dataKey="value" outerRadius={90}>
                {categoryData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-gray-500 text-center py-10">
            No expenses recorded for this month.
          </p>
        )}
      </section>

      {/* TRANSACTION TABLE */}
      <section className="bg-white/80 backdrop-blur-lg p-6 rounded-2xl shadow border border-gray-200">
        <h2 className="font-semibold text-lg text-[#0b1222] mb-4">
          Transaction History
        </h2>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-gray-600 border-b border-gray-200">
                <th className="pb-3">Date</th>
                <th className="pb-3">Type</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Note</th>
                <th className="pb-3 text-right">Amount</th>
                <th className="pb-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-100 last:border-none"
                >
                  <td className="py-3 text-gray-700">{t.date}</td>
                  <td className="py-3 text-gray-700">{t.type}</td>
                  <td className="py-3 text-gray-700">{t.category}</td>
                  <td className="py-3 text-gray-700">{t.note}</td>
                  <td
                    className={`py-3 text-right font-medium ${
                      t.type === "Expense" ? "text-red-500" : "text-green-600"
                    }`}
                  >
                    {t.type === "Expense" ? "-" : "+"}RM {t.amount.toFixed(2)}
                  </td>
                  <td className="py-3 text-right space-x-3">
                    <button
                      onClick={() => handleEdit(t)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-gray-500 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <div className="flex justify-center items-center mt-5 gap-4">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="p-2 rounded-lg border bg-white hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm font-medium">
            Page {page} of {totalPages}
          </span>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="p-2 rounded-lg border bg-white hover:bg-gray-100 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Components                                   */
/* -------------------------------------------------------------------------- */

const SummaryCard = ({ label, value, color }) => (
  <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow border border-gray-200">
    <p className="text-gray-600 text-sm">{label}</p>
    <h3
      className={`text-2xl font-semibold ${
        color === "emerald"
          ? "text-emerald-600"
          : color === "red"
          ? "text-red-500"
          : "text-sky-600"
      }`}
    >
      RM {value.toFixed(2)}
    </h3>
  </div>
);

const StatComparison = ({ title, current, last, color }) => (
  <div className="p-4 bg-slate-50 rounded-xl border border-gray-200">
    <p className="text-gray-600 text-sm">{title}</p>
    <h3
      className={`text-xl font-bold ${
        color === "emerald"
          ? "text-emerald-600"
          : color === "red"
          ? "text-red-500"
          : "text-sky-600"
      }`}
    >
      RM {current.toFixed(2)}
    </h3>
    <p className="text-xs text-gray-500 mt-1">
      Last Month: RM {last.toFixed(2)}
    </p>
    <p
      className={`text-sm font-semibold mt-1 ${
        current - last >= 0 ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {current - last >= 0 ? "+" : ""}
      {(current - last).toFixed(2)}
    </p>
  </div>
);
