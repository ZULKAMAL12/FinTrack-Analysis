import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  PiggyBank,
  CreditCard,
  Trash2,
  Save,
  X,
  Plus,
  Pencil,
  Loader2,
  CloudOff,
  Wallet,
  TrendingUp,
} from "lucide-react";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

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

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* -------------------------- UI config for sections ------------------------- */
const SECTION_UI = {
  income: {
    icon: <ArrowUpCircle className="w-5 h-5 text-green-600" />,
    gradient: "from-green-50 to-green-100",
    border: "border-green-200",
  },
  expense: {
    icon: <ArrowDownCircle className="w-5 h-5 text-red-600" />,
    gradient: "from-red-50 to-red-100",
    border: "border-red-200",
  },
  saving: {
    icon: <PiggyBank className="w-5 h-5 text-blue-600" />,
    gradient: "from-blue-50 to-blue-100",
    border: "border-blue-200",
  },
  debt: {
    icon: <CreditCard className="w-5 h-5 text-purple-600" />,
    gradient: "from-purple-50 to-purple-100",
    border: "border-purple-200",
  },
};

const DEFAULT_SECTIONS = [
  { name: "Income 💰", type: "income", items: [] },
  { name: "Expenses 💸", type: "expense", items: [] },
  { name: "Savings 🏦", type: "saving", items: [] },
  { name: "Debt 💳", type: "debt", items: [] },
];

function formatRM(value) {
  const n = Number(value || 0);
  return `RM ${n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Custom label for pie slices (shows RM + %)
function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  value,
}) {
  // Hide labels for tiny slices
  if (!value || value <= 0 || percent < 0.05) return null;

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.62;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#0b1222"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 700 }}
    >
      {`${formatRM(value)} (${(percent * 100).toFixed(0)}%)`}
    </text>
  );
}

export default function BudgetDashboard() {
  const now = new Date();
  const [period, setPeriod] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });

  const [sections, setSections] = useState(DEFAULT_SECTIONS);
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    autosaving: false,
    error: "",
    success: "",
    offlineSaveError: false,
  });

  // Avoid autosave on first load (when we set state from backend)
  const didHydrateRef = useRef(false);
  const autosaveTimerRef = useRef(null);

  // Modal state (supports add + edit)
  const [modal, setModal] = useState({
    open: false,
    mode: "add", // "add" | "edit"
    sectionIndex: null,
    itemIndex: null,
    label: "",
    amount: "",
    error: "",
  });

  async function loadBudget() {
    setStatus((s) => ({
      ...s,
      loading: true,
      error: "",
      success: "",
      offlineSaveError: false,
    }));
    try {
      const res = await apiFetch(
        `/api/budgets?year=${period.year}&month=${period.month}`
      );
      const nextSections = res?.budget?.sections?.length
        ? res.budget.sections
        : DEFAULT_SECTIONS;

      setSections(nextSections);
      didHydrateRef.current = true;

      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to load budget.",
      }));
    }
  }

  async function saveBudget(
    payloadSections = sections,
    { silent = false } = {}
  ) {
    if (!silent) {
      setStatus((s) => ({
        ...s,
        saving: true,
        error: "",
        success: "",
        offlineSaveError: false,
      }));
    } else {
      setStatus((s) => ({
        ...s,
        autosaving: true,
        offlineSaveError: false,
      }));
    }

    try {
      await apiFetch(`/api/budgets?year=${period.year}&month=${period.month}`, {
        method: "PUT",
        body: JSON.stringify({ sections: payloadSections }),
      });

      if (!silent) {
        setStatus((s) => ({ ...s, saving: false, success: "Saved ✅" }));
        setTimeout(() => setStatus((s) => ({ ...s, success: "" })), 1200);
      } else {
        setStatus((s) => ({ ...s, autosaving: false }));
      }
    } catch (e) {
      if (!silent) {
        setStatus((s) => ({
          ...s,
          saving: false,
          error: e?.message || "Failed to save budget.",
          offlineSaveError: true,
        }));
      } else {
        setStatus((s) => ({
          ...s,
          autosaving: false,
          offlineSaveError: true,
        }));
      }
    }
  }

  useEffect(() => {
    didHydrateRef.current = false;
    loadBudget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.year, period.month]);

  // Debounced autosave whenever sections change (after first hydration)
  useEffect(() => {
    if (!didHydrateRef.current) return;

    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);

    autosaveTimerRef.current = setTimeout(() => {
      saveBudget(sections, { silent: true });
    }, 650);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sections]);

  /* ----------------------------------------------- */
  /*                  Auto Totals                    */
  /* ----------------------------------------------- */
  const totals = useMemo(() => {
    let income = 0,
      expenses = 0,
      savings = 0,
      debt = 0;

    sections.forEach((sec) => {
      const total = (sec.items || []).reduce(
        (a, i) => a + Number(i.amount || 0),
        0
      );
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
  /*         Extra insights (more useful info)        */
  /* ----------------------------------------------- */
  const topExpenses = useMemo(() => {
    const expenseSection = sections.find((s) => s.type === "expense");
    const items = (expenseSection?.items || [])
      .map((i) => ({
        label: i.label || "Untitled",
        amount: Number(i.amount || 0),
      }))
      .filter((i) => i.amount > 0)
      .sort((a, b) => b.amount - a.amount);

    return items.slice(0, 3);
  }, [sections]);

  const ratios = useMemo(() => {
    const income = totals.income;
    const savingsRate = income > 0 ? (totals.savings / income) * 100 : 0;
    const expenseRate = income > 0 ? (totals.expenses / income) * 100 : 0;
    const debtRate = income > 0 ? (totals.debt / income) * 100 : 0;

    return {
      savingsRate,
      expenseRate,
      debtRate,
    };
  }, [totals]);

  /* ----------------------------------------------- */
  /*                     Pie Data                     */
  /* ----------------------------------------------- */
  const distributionData = useMemo(() => {
    return [
      { name: "Expenses", value: totals.expenses, color: "#ef4444" },
      { name: "Savings", value: totals.savings, color: "#0ea5e9" },
      { name: "Debt", value: totals.debt, color: "#a855f7" },
      { name: "Remaining", value: Math.max(totals.net, 0), color: "#22c55e" },
    ];
  }, [totals]);

  /* ----------------------------------------------- */
  /*                Add / Edit / Remove Items        */
  /* ----------------------------------------------- */
  function openAddModal(sectionIndex) {
    setModal({
      open: true,
      mode: "add",
      sectionIndex,
      itemIndex: null,
      label: "",
      amount: "",
      error: "",
    });
  }

  function openEditModal(sectionIndex, itemIndex) {
    const item = sections?.[sectionIndex]?.items?.[itemIndex];
    if (!item) return;

    setModal({
      open: true,
      mode: "edit",
      sectionIndex,
      itemIndex,
      label: item.label ?? "",
      amount:
        item.amount === 0 || item.amount ? String(Number(item.amount)) : "",
      error: "",
    });
  }

  function closeModal() {
    setModal((m) => ({ ...m, open: false, error: "" }));
  }

  function validateModal() {
    const label = modal.label.trim();
    const amountNum = Number(modal.amount);

    if (!label) return "Item name is required.";
    if (Number.isNaN(amountNum) || amountNum < 0)
      return "Amount must be a valid number (>= 0).";
    return "";
  }

  function onSubmitModal(e) {
    e.preventDefault();

    const validationError = validateModal();
    if (validationError) {
      setModal((m) => ({ ...m, error: validationError }));
      return;
    }

    const label = modal.label.trim();
    const amountNum = Number(modal.amount);

    if (modal.sectionIndex === null) return;

    setSections((prev) => {
      const updated = structuredClone(prev);

      if (modal.mode === "add") {
        updated[modal.sectionIndex].items.push({ label, amount: amountNum });
        return updated;
      }

      if (modal.mode === "edit") {
        if (modal.itemIndex === null) return prev;
        if (!updated[modal.sectionIndex]?.items?.[modal.itemIndex]) return prev;

        updated[modal.sectionIndex].items[modal.itemIndex] = {
          label,
          amount: amountNum,
        };
        return updated;
      }

      return prev;
    });

    closeModal();
  }

  const removeItem = (sectionIndex, itemIndex) => {
    setSections((prev) => {
      const updated = structuredClone(prev);
      updated[sectionIndex].items.splice(itemIndex, 1);
      return updated;
    });
  };

  /* ----------------------------------------------- */
  /*                     UI                           */
  /* ----------------------------------------------- */
  const monthLabel = new Date(period.year, period.month - 1, 1).toLocaleString(
    "en",
    { month: "long" }
  );

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f8fbff] via-[#eef3ff] to-[#dce5ff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#0b1222]">Budget Overview</h1>
          <p className="text-gray-600 text-lg">
            Your monthly budget breakdown for{" "}
            <span className="font-semibold text-slate-800">
              {monthLabel} {period.year}
            </span>
            .
          </p>
        </div>

        {/* Period + Save controls */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={period.month}
            onChange={(e) =>
              setPeriod((p) => ({ ...p, month: Number(e.target.value) }))
            }
            className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-300"
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={i + 1} className="text-slate-800">
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
                year: Number(e.target.value || now.getFullYear()),
              }))
            }
            className="w-28 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:border-sky-300 [color-scheme:light]"
            min={2000}
            max={2100}
          />

          <button
            onClick={() => saveBudget(sections, { silent: false })}
            disabled={status.loading || status.saving}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold shadow-sm transition ${
              status.loading || status.saving
                ? "bg-slate-300 cursor-not-allowed text-white"
                : "bg-sky-600 hover:bg-sky-700 text-white"
            }`}
            type="button"
          >
            {status.saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {status.saving ? "Saving..." : "Save Changes"}
          </button>

          {/* Autosave indicator */}
          <div className="flex items-center gap-2 text-xs">
            {status.autosaving ? (
              <span className="inline-flex items-center gap-2 text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" />
                Autosaving...
              </span>
            ) : status.offlineSaveError ? (
              <span className="inline-flex items-center gap-2 text-rose-700">
                <CloudOff className="w-4 h-4" />
                Save failed (check backend)
              </span>
            ) : (
              <span className="text-slate-500">Autosave on</span>
            )}
          </div>
        </div>
      </header>

      {(status.error || status.success) && (
        <div
          className={`mb-6 rounded-2xl px-5 py-3 text-sm border ${
            status.error
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {status.error || status.success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* LEFT COLUMN */}
        <aside className="bg-white/90 backdrop-blur-xl rounded-2xl border border-gray-200 shadow p-6">
          <h2 className="text-2xl font-semibold text-[#0b1222] mb-4">
            Summary & Insights
          </h2>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <KpiTile
              label="Income"
              value={formatRM(totals.income)}
              icon={<ArrowUpCircle className="w-4 h-4 text-emerald-600" />}
            />
            <KpiTile
              label="Expenses"
              value={formatRM(totals.expenses)}
              icon={<ArrowDownCircle className="w-4 h-4 text-rose-600" />}
            />
            <KpiTile
              label="Savings"
              value={formatRM(totals.savings)}
              icon={<PiggyBank className="w-4 h-4 text-sky-600" />}
            />
            <KpiTile
              label="Debt"
              value={formatRM(totals.debt)}
              icon={<CreditCard className="w-4 h-4 text-violet-600" />}
            />
          </div>

          {/* Pie Chart with labels (no hover needed) */}
          <div className="h-[280px] mb-4">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distributionData}
                  innerRadius={52}
                  outerRadius={105}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={renderPieLabel}
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Net Balance + status */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Remaining / Net Balance</p>
              <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border">
                {totals.net < 0 ? (
                  <>
                    <span className="text-rose-700 border-rose-200">
                      Overspent
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-emerald-700 border-emerald-200">
                      Healthy
                    </span>
                  </>
                )}
              </div>
            </div>

            <p
              className={`mt-2 text-3xl font-bold ${
                totals.net < 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {formatRM(totals.net)}
            </p>

            <p className="text-xs text-slate-500 mt-1">
              Net = Income − Expenses − Savings − Debt
            </p>
          </div>

          {/* Ratios */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MiniStat
              label="Savings"
              value={`${ratios.savingsRate.toFixed(1)}%`}
              icon={<PiggyBank className="w-4 h-4 text-sky-600" />}
            />
            <MiniStat
              label="Expenses"
              value={`${ratios.expenseRate.toFixed(1)}%`}
              icon={<Wallet className="w-4 h-4 text-rose-600" />}
            />
            <MiniStat
              label="Debt"
              value={`${ratios.debtRate.toFixed(1)}%`}
              icon={<TrendingUp className="w-4 h-4 text-violet-600" />}
            />
          </div>

          {/* Top expenses */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-[#0b1222] mb-2">
              Top Expenses (This Month)
            </p>

            {topExpenses.length === 0 ? (
              <p className="text-sm text-slate-600">
                No expense items yet. Add a few to see insights here.
              </p>
            ) : (
              <ul className="space-y-2">
                {topExpenses.map((x, idx) => (
                  <li
                    key={`${x.label}-${idx}`}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-slate-700">{x.label}</span>
                    <span className="font-semibold text-slate-900">
                      {formatRM(x.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* RIGHT COLUMN – SECTIONS */}
        <section className="lg:col-span-2 space-y-8">
          {sections.map((sec, si) => {
            const ui = SECTION_UI[sec.type] || SECTION_UI.expense;
            const total = (sec.items || []).reduce(
              (a, i) => a + Number(i.amount || 0),
              0
            );

            return (
              <div
                key={`${sec.type}-${si}`}
                className={`bg-gradient-to-br ${ui.gradient} border ${ui.border} rounded-2xl p-6 shadow`}
              >
                {/* Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      {ui.icon}
                    </div>
                    <h2 className="text-xl font-semibold text-[#0b1222]">
                      {sec.name}
                    </h2>
                  </div>

                  <button
                    onClick={() => openAddModal(si)}
                    disabled={status.loading}
                    className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-sky-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                    type="button"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item
                  </button>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-700 border-b">
                        <th className="pb-2 text-left">Item</th>
                        <th className="pb-2 text-right">Amount (RM)</th>
                        <th className="pb-2 text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {(sec.items || []).map((item, ii) => (
                        <tr
                          key={ii}
                          className="border-b hover:bg-white/60 transition"
                        >
                          <td className="py-2 text-gray-800">{item.label}</td>
                          <td className="py-2 text-right font-semibold text-gray-900">
                            RM {Number(item.amount || 0).toFixed(2)}
                          </td>
                          <td className="py-2 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(si, ii)}
                                className="text-slate-700 hover:text-slate-900 transition"
                                title="Edit"
                                type="button"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeItem(si, ii)}
                                className="text-red-600 hover:text-red-700 transition"
                                title="Remove"
                                type="button"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {(!sec.items || sec.items.length === 0) && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={3}>
                            No items yet.
                          </td>
                        </tr>
                      )}
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

      {/* ------------------------------ ADD/EDIT MODAL ------------------------------ */}
      {modal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <button
            className="absolute inset-0 bg-black/40"
            onClick={closeModal}
            aria-label="Close modal"
            type="button"
          />

          {/* Modal box */}
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-[#0b1222]">
                  {modal.mode === "edit"
                    ? "Edit Budget Item"
                    : "Add Budget Item"}
                </h3>
                <p className="text-xs text-slate-500">
                  {modal.mode === "edit"
                    ? "Update the item details."
                    : "Add a new item into this section."}
                </p>
              </div>

              <button
                onClick={closeModal}
                className="p-2 rounded-xl hover:bg-slate-100 transition"
                aria-label="Close"
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={onSubmitModal} className="px-5 py-4 space-y-4">
              {modal.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {modal.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Item name
                </label>
                <input
                  value={modal.label}
                  onChange={(e) =>
                    setModal((m) => ({
                      ...m,
                      label: e.target.value,
                      error: "",
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="e.g., Rent, Groceries, ASB"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Amount (RM)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={modal.amount}
                  onChange={(e) =>
                    setModal((m) => ({
                      ...m,
                      amount: e.target.value,
                      error: "",
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400 [color-scheme:light]"
                  placeholder="0.00"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 transition"
                >
                  {modal.mode === "edit" ? (
                    <>
                      <Pencil className="w-4 h-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add Item
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

/* ------------------------------- UI Pieces -------------------------------- */
function KpiTile({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
          {icon}
        </div>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2 text-xs text-slate-600">
        <span className="p-1.5 rounded-lg bg-slate-50 border border-slate-200">
          {icon}
        </span>
        <span>{label}</span>
      </div>
      <p className="mt-2 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}
