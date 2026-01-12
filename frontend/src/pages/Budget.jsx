import { useState, useMemo } from "react";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  PiggyBank,
  CreditCard,
  Plus,
  Trash2,
} from "lucide-react";

import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function BudgetDashboard() {
  const [sections, setSections] = useState([
    {
      name: "Income 💰",
      icon: <ArrowUpCircle className="w-5 h-5 text-green-600" />,
      gradient: "from-green-50 to-green-100",
      border: "border-green-200",
      type: "income",
      items: [
        { label: "Monthly Salary", amount: 3800 },
        { label: "Freelance Work", amount: 600 },
        { label: "Allowance", amount: 150 },
      ],
    },
    {
      name: "Expenses 💸",
      icon: <ArrowDownCircle className="w-5 h-5 text-red-600" />,
      gradient: "from-red-50 to-red-100",
      border: "border-red-200",
      type: "expense",
      items: [
        { label: "Rent", amount: 550 },
        { label: "Groceries & Food", amount: 450 },
        { label: "Internet & Mobile", amount: 120 },
        { label: "Subscriptions", amount: 60 },
        { label: "Transportation", amount: 200 },
        { label: "Utilities", amount: 130 },
      ],
    },
    {
      name: "Savings 🏦",
      icon: <PiggyBank className="w-5 h-5 text-blue-600" />,
      gradient: "from-blue-50 to-blue-100",
      border: "border-blue-200",
      type: "saving",
      items: [
        { label: "ASB", amount: 200 },
        { label: "Versa-i", amount: 100 },
        { label: "Versa Gold", amount: 100 },
        { label: "Emergency Fund", amount: 150 },
      ],
    },
    {
      name: "Debt 💳",
      icon: <CreditCard className="w-5 h-5 text-purple-600" />,
      gradient: "from-purple-50 to-purple-100",
      border: "border-purple-200",
      type: "debt",
      items: [
        { label: "PTPTN Loan", amount: 120 },
        { label: "Credit Card", amount: 180 },
      ],
    },
  ]);

  /* ----------------------------------------------- */
  /*                  Auto Totals                    */
  /* ----------------------------------------------- */

  const totals = useMemo(() => {
    let income = 0,
      expenses = 0,
      savings = 0,
      debt = 0;

    sections.forEach((sec) => {
      const total = sec.items.reduce((a, i) => a + Number(i.amount), 0);
      if (sec.type === "income") income += total;
      else if (sec.type === "expense") expenses += total;
      else if (sec.type === "saving") savings += total;
      else if (sec.type === "debt") debt += total;
    });

    return {
      income,
      expenses,
      savings,
      debt,
      net: income - expenses - savings - debt,
    };
  }, [sections]);

  /* ----------------------------------------------- */
  /*                     Charts                       */
  /* ----------------------------------------------- */

  const trendData = [
    { month: "Jun", expenses: 1300, savings: 400 },
    { month: "Jul", expenses: 1250, savings: 420 },
    { month: "Aug", expenses: 1380, savings: 390 },
    { month: "Sep", expenses: 1400, savings: 450 },
    { month: "Oct", expenses: 1320, savings: 480 },
    { month: "Nov", expenses: totals.expenses, savings: totals.savings },
  ];

  const distributionData = [
    { name: "Expenses", value: totals.expenses, color: "#ef4444" },
    { name: "Savings", value: totals.savings, color: "#0ea5e9" },
    { name: "Debt", value: totals.debt, color: "#a855f7" },
    {
      name: "Remaining",
      value: Math.max(totals.net, 0),
      color: "#22c55e",
    },
  ];

  const addItem = (index) => {
    const label = prompt("Enter item name:");
    const amount = parseFloat(prompt("Enter amount (RM):"));
    if (!label || isNaN(amount)) return;
    const updated = [...sections];
    updated[index].items.push({ label, amount });
    setSections(updated);
  };

  const removeItem = (sectionIndex, itemIndex) => {
    const updated = [...sections];
    updated[sectionIndex].items.splice(itemIndex, 1);
    setSections(updated);
  };

  /* ----------------------------------------------- */
  /*                     UI                           */
  /* ----------------------------------------------- */

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f8fbff] via-[#eef3ff] to-[#dce5ff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-[#0b1222]">Budget Overview</h1>
        <p className="text-gray-600 text-lg">
          Track your monthly spending with clean visual insights.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* LEFT COLUMN */}
        <aside className="bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-200 shadow p-6">
          <h2 className="text-2xl font-semibold text-[#0b1222] mb-6">
            Summary & Insights
          </h2>

          {/* Pie Chart */}
          <div className="h-[260px] mb-8">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distributionData}
                  innerRadius={55}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Trend */}
          <div className="h-[160px] mb-8">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  stroke="#ef4444"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="savings"
                  stroke="#0284c7"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Insight Box */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-sm text-gray-700">
            💡 You saved{" "}
            <span className="font-semibold text-sky-700">
              {((totals.savings / totals.income) * 100).toFixed(1)}%
            </span>{" "}
            of your income. Your expense ratio is{" "}
            <span className="font-semibold text-red-600">
              {((totals.expenses / totals.income) * 100).toFixed(1)}%
            </span>
            .
          </div>

          {/* Net Balance */}
          <div className="mt-8 border-t pt-4">
            <p className="text-gray-500 text-sm">Net Balance</p>
            <h3
              className={`text-3xl font-bold ${
                totals.net < 0 ? "text-red-600" : "text-green-600"
              }`}
            >
              RM {totals.net.toFixed(2)}
            </h3>
          </div>
        </aside>

        {/* RIGHT COLUMN – SECTIONS */}
        <section className="lg:col-span-2 space-y-8">
          {sections.map((sec, si) => {
            const total = sec.items.reduce((a, i) => a + i.amount, 0);

            return (
              <div
                key={si}
                className={`bg-gradient-to-br ${sec.gradient} border ${sec.border} rounded-2xl p-6 shadow`}
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      {sec.icon}
                    </div>
                    <h2 className="text-xl font-semibold text-[#0b1222]">
                      {sec.name}
                    </h2>
                  </div>

                  <button
                    onClick={() => addItem(si)}
                    className="bg-sky-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-sky-700 transition"
                  >
                    + Add Item
                  </button>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-700 border-b">
                        <th className="pb-2">Item</th>
                        <th className="pb-2 text-right">Amount (RM)</th>
                        <th className="pb-2 text-right"></th>
                      </tr>
                    </thead>

                    <tbody>
                      {sec.items.map((item, ii) => (
                        <tr
                          key={ii}
                          className="border-b hover:bg-white/60 transition"
                        >
                          <td className="py-2 text-gray-800">{item.label}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">
                            RM {item.amount.toFixed(2)}
                          </td>
                          <td className="py-2 text-right">
                            <button
                              onClick={() => removeItem(si, ii)}
                              className="text-red-600 hover:text-red-700 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Section Total */}
                <div className="mt-4 text-right">
                  <span className="px-3 py-1 text-sm bg-white border rounded-lg">
                    Total:{" "}
                    <span className="font-bold text-gray-800">
                      RM {total.toFixed(2)}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </main>
  );
}
