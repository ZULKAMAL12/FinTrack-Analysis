import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Trash2,
  Save,
  X,
  Plus,
  Pencil,
  Loader2,
  CloudOff,
  Layers,
  Tag,
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
const UI_BY_KIND = {
  income: {
    icon: <ArrowUpCircle className="w-5 h-5 text-emerald-600" />,
    gradient: "from-emerald-50 to-emerald-100",
    border: "border-emerald-200",
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  expense: {
    icon: <ArrowDownCircle className="w-5 h-5 text-rose-600" />,
    gradient: "from-rose-50 to-rose-100",
    border: "border-rose-200",
    pill: "bg-rose-100 text-rose-700 border-rose-200",
  },
};

const DEFAULT_SECTIONS = [
  { name: "Income 💰", kind: "income", items: [] },
  { name: "Expenses 💸", kind: "expense", items: [] },
  { name: "Savings 🏦", kind: "expense", items: [] },
  { name: "Debt 💳", kind: "expense", items: [] },
];

function formatRM(value) {
  const n = Number(value || 0);
  return `RM ${n.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function normalizeSections(raw) {
  const safe = Array.isArray(raw) ? raw : [];
  if (safe.length === 0) return DEFAULT_SECTIONS;

  return safe.map((s) => {
    const items = Array.isArray(s.items) ? s.items : [];
    const legacyType = String(s.type || "").toLowerCase();
    const rawKind = String(s.kind || "").toLowerCase();

    const kind =
      rawKind === "income" || rawKind === "expense"
        ? rawKind
        : legacyType === "income"
        ? "income"
        : "expense";

    return {
      name: typeof s.name === "string" && s.name.trim() ? s.name : "Section",
      kind,
      type: s.type, // keep if backend returns it
      items: items.map((i) => ({
        label: typeof i.label === "string" ? i.label : "Item",
        amount: Number(i.amount || 0),
      })),
    };
  });
}

/* ------------------------- Pie label (RM + %) ------------------------- */
function renderPieLabel({
  cx,
  cy,
  midAngle,
  innerRadius,
  outerRadius,
  percent,
  value,
}) {
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

  // Item modal (add/edit item)
  const [itemModal, setItemModal] = useState({
    open: false,
    mode: "add", // "add" | "edit"
    sectionIndex: null,
    itemIndex: null,
    label: "",
    amount: "",
    error: "",
  });

  // Section modal (add/edit section)
  const [sectionModal, setSectionModal] = useState({
    open: false,
    mode: "add", // "add" | "edit"
    sectionIndex: null,
    name: "",
    kind: "expense", // income | expense
    error: "",
  });

  const monthLabel = new Date(period.year, period.month - 1, 1).toLocaleString(
    "en",
    { month: "long" }
  );

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

      setSections(normalizeSections(res?.budget?.sections));
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
  /*                    Totals                       */
  /* ----------------------------------------------- */
  const totals = useMemo(() => {
    let income = 0;
    let outflows = 0;

    sections.forEach((sec) => {
      const total = (sec.items || []).reduce(
        (a, i) => a + Number(i.amount || 0),
        0
      );

      if (sec.kind === "income") income += total;
      else outflows += total;
    });

    return {
      income,
      outflows,
      net: income - outflows,
    };
  }, [sections]);

  /* ----------------------------------------------- */
  /*              Expense sections breakdown          */
  /* ----------------------------------------------- */
  const expenseSectionTotals = useMemo(() => {
    return sections
      .map((sec, idx) => {
        const total = (sec.items || []).reduce(
          (a, i) => a + Number(i.amount || 0),
          0
        );
        return { idx, name: sec.name, kind: sec.kind, total };
      })
      .filter((x) => x.kind === "expense" && x.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [sections]);

  const topExpenseItems = useMemo(() => {
    const all = [];
    sections.forEach((sec) => {
      if (sec.kind !== "expense") return;
      (sec.items || []).forEach((i) => {
        const amount = Number(i.amount || 0);
        if (amount > 0) {
          all.push({
            label: i.label || "Untitled",
            amount,
            sectionName: sec.name,
          });
        }
      });
    });

    all.sort((a, b) => b.amount - a.amount);
    return all.slice(0, 5);
  }, [sections]);

  /* ----------------------------------------------- */
  /*                  Pie Chart Data                 */
  /* ----------------------------------------------- */
  const distributionData = useMemo(() => {
    // Pie shows OUTFLOW split by sections + Remaining
    const remaining = Math.max(totals.net, 0);

    const slices = expenseSectionTotals.map((s) => ({
      name: s.name,
      value: s.total,
      color: "#ef4444",
    }));

    // keep chart clean: top 4 + Others
    const MAX_SLICES = 5;
    slices.sort((a, b) => b.value - a.value);

    let finalSlices = slices;

    if (slices.length > MAX_SLICES) {
      const top = slices.slice(0, MAX_SLICES - 1);
      const rest = slices.slice(MAX_SLICES - 1);
      const othersVal = rest.reduce((sum, x) => sum + x.value, 0);
      finalSlices = [
        ...top,
        { name: "Others", value: othersVal, color: "#fb7185" },
      ];
    }

    const palette = [
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#a855f7",
      "#0ea5e9",
      "#22c55e",
    ];
    finalSlices = finalSlices.map((s, i) => ({
      ...s,
      color: palette[i % palette.length],
    }));

    if (remaining > 0) {
      finalSlices.push({
        name: "Remaining",
        value: remaining,
        color: "#22c55e",
      });
    }

    if (finalSlices.length === 0) {
      finalSlices = [{ name: "No data", value: 1, color: "#cbd5e1" }];
    }

    return finalSlices;
  }, [expenseSectionTotals, totals.net]);

  /* ----------------------------------------------- */
  /*               Section CRUD (custom)             */
  /* ----------------------------------------------- */
  function openAddSectionModal() {
    setSectionModal({
      open: true,
      mode: "add",
      sectionIndex: null,
      name: "",
      kind: "expense",
      error: "",
    });
  }

  function openEditSectionModal(sectionIndex) {
    const sec = sections?.[sectionIndex];
    if (!sec) return;

    setSectionModal({
      open: true,
      mode: "edit",
      sectionIndex,
      name: sec.name || "",
      kind: sec.kind === "income" ? "income" : "expense",
      error: "",
    });
  }

  function closeSectionModal() {
    setSectionModal((m) => ({ ...m, open: false, error: "" }));
  }

  function onSubmitSectionModal(e) {
    e.preventDefault();

    const name = sectionModal.name.trim();
    if (!name) {
      setSectionModal((m) => ({ ...m, error: "Section name is required." }));
      return;
    }

    const kind = sectionModal.kind === "income" ? "income" : "expense";

    setSections((prev) => {
      const updated = structuredClone(prev);

      if (sectionModal.mode === "add") {
        updated.push({ name, kind, items: [] });
        return updated;
      }

      if (sectionModal.mode === "edit") {
        const idx = sectionModal.sectionIndex;
        if (idx === null || !updated[idx]) return prev;
        updated[idx].name = name;
        updated[idx].kind = kind;
        return updated;
      }

      return prev;
    });

    closeSectionModal();
  }

  function removeSection(sectionIndex) {
    setSections((prev) => {
      const updated = structuredClone(prev);
      updated.splice(sectionIndex, 1);
      return updated.length ? updated : DEFAULT_SECTIONS;
    });
  }

  /* ----------------------------------------------- */
  /*               Item CRUD (add/edit)              */
  /* ----------------------------------------------- */
  function openAddItemModal(sectionIndex) {
    setItemModal({
      open: true,
      mode: "add",
      sectionIndex,
      itemIndex: null,
      label: "",
      amount: "",
      error: "",
    });
  }

  function openEditItemModal(sectionIndex, itemIndex) {
    const item = sections?.[sectionIndex]?.items?.[itemIndex];
    if (!item) return;

    setItemModal({
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

  function closeItemModal() {
    setItemModal((m) => ({ ...m, open: false, error: "" }));
  }

  function onSubmitItemModal(e) {
    e.preventDefault();

    const label = itemModal.label.trim();
    const amountNum = Number(itemModal.amount);

    if (!label) {
      setItemModal((m) => ({ ...m, error: "Item name is required." }));
      return;
    }
    if (Number.isNaN(amountNum) || amountNum < 0) {
      setItemModal((m) => ({ ...m, error: "Amount must be a number (>= 0)." }));
      return;
    }

    setSections((prev) => {
      const updated = structuredClone(prev);

      if (itemModal.mode === "add") {
        updated[itemModal.sectionIndex].items.push({
          label,
          amount: Math.round(amountNum * 100) / 100,
        });
        return updated;
      }

      if (itemModal.mode === "edit") {
        updated[itemModal.sectionIndex].items[itemModal.itemIndex] = {
          label,
          amount: Math.round(amountNum * 100) / 100,
        };
        return updated;
      }

      return prev;
    });

    closeItemModal();
  }

  function removeItem(sectionIndex, itemIndex) {
    setSections((prev) => {
      const updated = structuredClone(prev);
      updated[sectionIndex].items.splice(itemIndex, 1);
      return updated;
    });
  }

  /* ----------------------------------------------- */
  /*                     UI                          */
  /* ----------------------------------------------- */
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f8fbff] via-[#eef3ff] to-[#dce5ff] px-6 md:px-12 py-10 font-inter">
      {/* HEADER */}
      <header className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#0b1222]">Budget Overview</h1>
          <p className="text-gray-600 text-lg">
            Your budget for{" "}
            <span className="font-semibold text-slate-800">
              {monthLabel} {period.year}
            </span>
            .
          </p>
        </div>

        {/* Period + Actions */}
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
            onClick={openAddSectionModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition shadow-sm"
            type="button"
          >
            <Layers className="w-4 h-4" />
            Add Section
          </button>

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

          {/* KPI Tiles */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <KpiTile
              label="Total Income"
              value={formatRM(totals.income)}
              icon={<ArrowUpCircle className="w-4 h-4 text-emerald-600" />}
            />
            <KpiTile
              label="Total Outflow"
              value={formatRM(totals.outflows)}
              icon={<ArrowDownCircle className="w-4 h-4 text-rose-600" />}
            />
          </div>

          {/* Pie Chart */}
          <div className="h-[300px] mb-4">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distributionData}
                  innerRadius={52}
                  outerRadius={110}
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

          {/* Net balance + ratios */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">Remaining / Net Balance</p>
              <span
                className={`text-xs px-3 py-1 rounded-full border ${
                  totals.net < 0
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {totals.net < 0 ? "Overspent" : "Healthy"}
              </span>
            </div>

            <p
              className={`mt-2 text-3xl font-bold ${
                totals.net < 0 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {formatRM(totals.net)}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-600">Outflow Ratio</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {totals.income > 0
                    ? `${((totals.outflows / totals.income) * 100).toFixed(1)}%`
                    : "0.0%"}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-slate-600">Remaining Ratio</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {totals.income > 0
                    ? `${(
                        (Math.max(totals.net, 0) / totals.income) *
                        100
                      ).toFixed(1)}%`
                    : "0.0%"}
                </p>
              </div>
            </div>
          </div>

          {/* Top outflows */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-[#0b1222] mb-2">
              Top Outflows (This Month)
            </p>

            {topExpenseItems.length === 0 ? (
              <p className="text-sm text-slate-600">
                Add expense items to see insights.
              </p>
            ) : (
              <ul className="space-y-2">
                {topExpenseItems.map((x, idx) => (
                  <li
                    key={`${x.label}-${idx}`}
                    className="flex items-start justify-between text-sm gap-3"
                  >
                    <div>
                      <p className="text-slate-700">{x.label}</p>
                      <p className="text-xs text-slate-500">{x.sectionName}</p>
                    </div>
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
            const ui = UI_BY_KIND[sec.kind] || UI_BY_KIND.expense;
            const total = (sec.items || []).reduce(
              (a, i) => a + Number(i.amount || 0),
              0
            );

            return (
              <div
                key={`${sec.name}-${si}`}
                className={`bg-gradient-to-br ${ui.gradient} border ${ui.border} rounded-2xl p-6 shadow`}
              >
                {/* Header */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-white p-2 rounded-lg shadow-sm">
                      {ui.icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-[#0b1222]">
                          {sec.name}
                        </h2>
                        <span
                          className={`text-[11px] px-2.5 py-1 rounded-full border ${ui.pill}`}
                        >
                          {sec.kind === "income" ? "Income" : "Outflow"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 mt-0.5">
                        Total:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatRM(total)}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openAddItemModal(si)}
                      disabled={status.loading}
                      className="inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2 text-sm rounded-lg hover:bg-sky-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
                      type="button"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>

                    <button
                      onClick={() => openEditSectionModal(si)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition"
                      type="button"
                      title="Edit section"
                    >
                      <Tag className="w-4 h-4 text-slate-700" />
                    </button>

                    <button
                      onClick={() => removeSection(si)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 transition"
                      type="button"
                      title="Remove section"
                    >
                      <Trash2 className="w-4 h-4 text-rose-700" />
                    </button>
                  </div>
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
                                onClick={() => openEditItemModal(si, ii)}
                                className="text-slate-700 hover:text-slate-900 transition"
                                title="Edit item"
                                type="button"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removeItem(si, ii)}
                                className="text-rose-600 hover:text-rose-700 transition"
                                title="Remove item"
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
              </div>
            );
          })}
        </section>
      </div>

      {/* ------------------------------ SECTION MODAL ------------------------------ */}
      {sectionModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
        >
          <button
            className="absolute inset-0 bg-black/40"
            onClick={closeSectionModal}
            aria-label="Close modal"
            type="button"
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-[#0b1222]">
                  {sectionModal.mode === "edit"
                    ? "Edit Section"
                    : "Add Section"}
                </h3>
                <p className="text-xs text-slate-500">
                  Create sections like “Side Income”, “Family Expense”, etc.
                </p>
              </div>

              <button
                onClick={closeSectionModal}
                className="p-2 rounded-xl hover:bg-slate-100 transition"
                aria-label="Close"
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form
              onSubmit={onSubmitSectionModal}
              className="px-5 py-4 space-y-4"
            >
              {sectionModal.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {sectionModal.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Section name
                </label>
                <input
                  value={sectionModal.name}
                  onChange={(e) =>
                    setSectionModal((m) => ({
                      ...m,
                      name: e.target.value,
                      error: "",
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="e.g., Side Income / Family Expenses"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Section type
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setSectionModal((m) => ({
                        ...m,
                        kind: "income",
                        error: "",
                      }))
                    }
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                      sectionModal.kind === "income"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Income
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setSectionModal((m) => ({
                        ...m,
                        kind: "expense",
                        error: "",
                      }))
                    }
                    className={`px-4 py-3 rounded-xl border text-sm font-semibold transition ${
                      sectionModal.kind === "expense"
                        ? "bg-rose-50 border-rose-200 text-rose-700"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    Outflow (Expense)
                  </button>
                </div>

                <p className="text-xs text-slate-500 mt-2">
                  Tip: Savings and Debt are also “Outflow”.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeSectionModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 transition"
                >
                  <Plus className="w-4 h-4" />
                  {sectionModal.mode === "edit"
                    ? "Save Section"
                    : "Add Section"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------ ITEM MODAL ------------------------------ */}
      {itemModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          aria-modal="true"
          role="dialog"
        >
          <button
            className="absolute inset-0 bg-black/40"
            onClick={closeItemModal}
            aria-label="Close modal"
            type="button"
          />

          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="text-lg font-semibold text-[#0b1222]">
                  {itemModal.mode === "edit" ? "Edit Item" : "Add Item"}
                </h3>
                <p className="text-xs text-slate-500">
                  Add items inside the selected section.
                </p>
              </div>

              <button
                onClick={closeItemModal}
                className="p-2 rounded-xl hover:bg-slate-100 transition"
                aria-label="Close"
                type="button"
              >
                <X className="w-5 h-5 text-slate-600" />
              </button>
            </div>

            <form onSubmit={onSubmitItemModal} className="px-5 py-4 space-y-4">
              {itemModal.error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {itemModal.error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Item name
                </label>
                <input
                  value={itemModal.label}
                  onChange={(e) =>
                    setItemModal((m) => ({
                      ...m,
                      label: e.target.value,
                      error: "",
                    }))
                  }
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  placeholder="e.g., Rent / Groceries"
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
                  value={itemModal.amount}
                  onChange={(e) =>
                    setItemModal((m) => ({
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
                  onClick={closeItemModal}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-600 text-white font-semibold hover:bg-sky-700 transition"
                >
                  {itemModal.mode === "edit" ? (
                    <>
                      <Pencil className="w-4 h-4" />
                      Save Item
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
