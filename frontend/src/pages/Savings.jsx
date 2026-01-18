import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus,
  PiggyBank,
  RefreshCw,
  Settings,
  Pencil,
  MinusCircle,
  X,
  Loader2,
  CloudOff,
  Trash2,
  Wallet,
  LineChart as LineIcon,
  PieChart as PieIcon,
} from "lucide-react";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
  Tooltip,
  PieChart,
  Pie,
  Cell,
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

  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

/* ---------------------------- Return frequency ---------------------------- */
const RETURN_FREQ = [
  { value: "daily", label: "Daily (Versa/TNG)", periodsPerYear: 365 },
  { value: "weekly", label: "Weekly", periodsPerYear: 52 },
  { value: "monthly", label: "Monthly", periodsPerYear: 12 },
  { value: "yearly", label: "Yearly (ASB/KWSP)", periodsPerYear: 1 },
];

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function formatRM(n) {
  const v = safeNumber(n, 0);
  return `RM ${v.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Estimate periodic return amount (simple):
 * annualReturn = capital * rate%
 * periodicReturn = annualReturn / periodsPerYear
 */
function estimateReturn(capital, ratePercent, freq) {
  const cap = safeNumber(capital, 0);
  const rate = safeNumber(ratePercent, 0);
  if (cap <= 0 || rate <= 0) return 0;

  const annual = cap * (rate / 100);

  switch (freq) {
    case "daily":
      return annual / 365;
    case "weekly":
      return annual / 52;
    case "monthly":
      return annual / 12;
    case "yearly":
    default:
      return annual;
  }
}

/**
 * Build a 12-month projection for TOTAL portfolio:
 * - Each month: add monthlyContribution for each account
 * - Add estimated returns (converted to monthly)
 *
 * This is a simple projection (not perfect compounding like real platforms),
 * but it's consistent + useful for planning.
 */
function buildProjection12M(accounts) {
  const months = [];
  const now = new Date();

  // start value: total portfolio value now
  let totalValue = accounts.reduce(
    (sum, a) => sum + safeNumber(a.capital) + safeNumber(a.dividend),
    0
  );

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString("en", { month: "short" });

    // monthly add from all accounts
    const monthlyAdd = accounts.reduce(
      (sum, a) => sum + safeNumber(a.monthlyContribution),
      0
    );

    // monthly estimated return from all accounts (convert their freq to monthly)
    const monthlyReturn = accounts.reduce((sum, a) => {
      const cap = safeNumber(a.capital);
      const rate = safeNumber(a.ratePercent);
      const freq = a.returnFrequency || "daily";
      const periodic = estimateReturn(cap, rate, freq);

      // convert periodic to monthly estimate:
      // daily*30, weekly*4.345, monthly*1, yearly/12
      if (freq === "daily") return sum + periodic * 30;
      if (freq === "weekly") return sum + periodic * 4.345;
      if (freq === "monthly") return sum + periodic * 1;
      return sum + periodic / 12; // yearly
    }, 0);

    totalValue += monthlyAdd + monthlyReturn;

    months.push({
      month: label,
      value: Number(totalValue.toFixed(2)),
      add: Number(monthlyAdd.toFixed(2)),
      ret: Number(monthlyReturn.toFixed(2)),
    });
  }

  return months;
}

/* ------------------------------- Component -------------------------------- */
export default function SavingsPage() {
  const [status, setStatus] = useState({
    loading: true,
    saving: false,
    error: "",
    offlineSaveError: false,
  });

  const [accounts, setAccounts] = useState([]);
  const didHydrateRef = useRef(false);

  // Modals
  const [addModal, setAddModal] = useState({
    open: false,
    name: "",
    color: "#0ea5e9",
    goal: "",
    initialCapital: "",
    ratePercent: "",
    returnFrequency: "daily",
    monthlyContribution: "",
    autoSave: false,
    autoAmount: "",
    error: "",
  });

  const [editModal, setEditModal] = useState({
    open: false,
    id: null,
    name: "",
    color: "#0ea5e9",
    goal: "",
    initialCapital: "",
    ratePercent: "",
    returnFrequency: "daily",
    monthlyContribution: "",
    autoSave: false,
    autoAmount: "",
    error: "",
  });

  const [withdrawModal, setWithdrawModal] = useState({
    open: false,
    id: null,
    name: "",
    amount: "",
    error: "",
  });

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    id: null,
    name: "",
    error: "",
  });

  async function loadSavings() {
    setStatus((s) => ({
      ...s,
      loading: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      const res = await apiFetch("/api/savings");
      setAccounts(Array.isArray(res.accounts) ? res.accounts : []);
      didHydrateRef.current = true;
      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to load savings.",
      }));
    }
  }

  useEffect(() => {
    didHydrateRef.current = false;
    loadSavings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------- Totals -------------------------------- */
  const totals = useMemo(() => {
    const capital = accounts.reduce((a, b) => a + safeNumber(b.capital), 0);
    const dividend = accounts.reduce((a, b) => a + safeNumber(b.dividend), 0);
    const total = capital + dividend;
    const roi = capital > 0 ? (dividend / capital) * 100 : 0;
    return { capital, dividend, total, roi };
  }, [accounts]);

  /* ----------------------------- Charts data ------------------------------ */
  const allocationData = useMemo(() => {
    return accounts
      .map((a) => {
        const value = safeNumber(a.capital) + safeNumber(a.dividend);
        return {
          name: a.name || "Untitled",
          value,
          color: a.color || "#0ea5e9",
        };
      })
      .filter((x) => x.value > 0);
  }, [accounts]);

  const projection12m = useMemo(() => buildProjection12M(accounts), [accounts]);

  /* ----------------------------- Modal Actions ----------------------------- */
  function openAddAccount() {
    setAddModal({
      open: true,
      name: "",
      color: "#0ea5e9",
      goal: "",
      initialCapital: "",
      ratePercent: "",
      returnFrequency: "daily",
      monthlyContribution: "",
      autoSave: false,
      autoAmount: "",
      error: "",
    });
  }

  async function createAccount(e) {
    e.preventDefault();

    const name = addModal.name.trim();
    if (!name)
      return setAddModal((m) => ({ ...m, error: "Account name is required." }));

    const payload = {
      name,
      color: addModal.color,
      goal: safeNumber(addModal.goal, 0),
      autoSave: !!addModal.autoSave,
      autoAmount: safeNumber(addModal.autoAmount, 0),

      initialCapital: safeNumber(addModal.initialCapital, 0),
      ratePercent: safeNumber(addModal.ratePercent, 0),
      returnFrequency: addModal.returnFrequency || "daily",
      monthlyContribution: safeNumber(addModal.monthlyContribution, 0),
    };

    setStatus((s) => ({
      ...s,
      saving: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      const res = await apiFetch("/api/savings", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setAccounts((prev) => [res.account, ...prev]);
      setAddModal((m) => ({ ...m, open: false }));
      setStatus((s) => ({ ...s, saving: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, saving: false, offlineSaveError: true }));
      setAddModal((m) => ({
        ...m,
        error: e2?.message || "Failed to create account.",
      }));
    }
  }

  function openEditAccount(acc) {
    setEditModal({
      open: true,
      id: acc._id,
      name: acc.name || "",
      color: acc.color || "#0ea5e9",
      goal: String(safeNumber(acc.goal)),
      autoSave: !!acc.autoSave,
      autoAmount: String(safeNumber(acc.autoAmount)),

      initialCapital: String(safeNumber(acc.initialCapital)),
      ratePercent: String(safeNumber(acc.ratePercent)),
      returnFrequency: acc.returnFrequency || "daily",
      monthlyContribution: String(safeNumber(acc.monthlyContribution)),
      error: "",
    });
  }

  async function saveEditAccount(e) {
    e.preventDefault();

    const name = editModal.name.trim();
    if (!name)
      return setEditModal((m) => ({
        ...m,
        error: "Account name is required.",
      }));

    const payload = {
      name,
      color: editModal.color,
      goal: safeNumber(editModal.goal, 0),
      autoSave: !!editModal.autoSave,
      autoAmount: safeNumber(editModal.autoAmount, 0),

      initialCapital: safeNumber(editModal.initialCapital, 0),
      ratePercent: safeNumber(editModal.ratePercent, 0),
      returnFrequency: editModal.returnFrequency || "daily",
      monthlyContribution: safeNumber(editModal.monthlyContribution, 0),
    };

    setStatus((s) => ({
      ...s,
      saving: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      const res = await apiFetch(`/api/savings/${editModal.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });

      setAccounts((prev) =>
        prev.map((a) => (a._id === res.account._id ? res.account : a))
      );
      setEditModal((m) => ({ ...m, open: false }));
      setStatus((s) => ({ ...s, saving: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, saving: false, offlineSaveError: true }));
      setEditModal((m) => ({
        ...m,
        error: e2?.message || "Failed to update account.",
      }));
    }
  }

  function openWithdraw(acc) {
    setWithdrawModal({
      open: true,
      id: acc._id,
      name: acc.name,
      amount: "",
      error: "",
    });
  }

  async function confirmWithdraw(e) {
    e.preventDefault();

    const amount = safeNumber(withdrawModal.amount, -1);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setWithdrawModal((m) => ({
        ...m,
        error: "Enter a valid amount (> 0).",
      }));
    }

    setStatus((s) => ({
      ...s,
      saving: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      const res = await apiFetch(
        `/api/savings/${withdrawModal.id}/transactions`,
        {
          method: "POST",
          body: JSON.stringify({ type: "withdraw", amount }),
        }
      );

      setAccounts((prev) =>
        prev.map((a) => (a._id === res.account._id ? res.account : a))
      );
      setWithdrawModal((m) => ({ ...m, open: false }));
      setStatus((s) => ({ ...s, saving: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, saving: false, offlineSaveError: true }));
      setWithdrawModal((m) => ({
        ...m,
        error: e2?.message || "Withdraw failed.",
      }));
    }
  }

  async function toggleAutoSave(acc) {
    setStatus((s) => ({
      ...s,
      saving: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      const res = await apiFetch(`/api/savings/${acc._id}`, {
        method: "PUT",
        body: JSON.stringify({ autoSave: !acc.autoSave }),
      });

      setAccounts((prev) =>
        prev.map((a) => (a._id === res.account._id ? res.account : a))
      );
      setStatus((s) => ({ ...s, saving: false }));
    } catch (e2) {
      setStatus((s) => ({
        ...s,
        saving: false,
        error: e2?.message || "Failed to toggle auto save.",
        offlineSaveError: true,
      }));
    }
  }

  function openDelete(acc) {
    setDeleteModal({
      open: true,
      id: acc._id,
      name: acc.name,
      error: "",
    });
  }

  async function confirmDelete() {
    if (!deleteModal.id) return;

    setStatus((s) => ({
      ...s,
      saving: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(`/api/savings/${deleteModal.id}`, {
        method: "DELETE",
      });

      setAccounts((prev) => prev.filter((a) => a._id !== deleteModal.id));
      setDeleteModal({ open: false, id: null, name: "", error: "" });
      setStatus((s) => ({ ...s, saving: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, saving: false, offlineSaveError: true }));
      setDeleteModal((m) => ({
        ...m,
        error: e?.message || "Delete failed.",
      }));
    }
  }

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf4ff] to-[#e5edff] px-6 md:px-12 py-10 font-inter overflow-hidden">
      {/* Header */}
      <header className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-bold text-[#0b1222]">Savings Tracker</h1>
          <p className="text-gray-600 text-lg mt-1">
            Track savings accounts with return frequency (daily/monthly/yearly)
            + contributions + withdrawals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* ✅ fixed refresh icon/text color */}
          <button
            onClick={() => loadSavings()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900 transition"
            type="button"
          >
            <RefreshCw className="w-4 h-4 text-slate-700" />
            Refresh
          </button>

          <button
            onClick={openAddAccount}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.03] transition"
            type="button"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </header>

      {(status.error || status.offlineSaveError) && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 flex items-center gap-2">
          <CloudOff className="w-4 h-4" />
          {status.error || "Backend request failed. Check server + token."}
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <SummaryCard
          label="Total Capital"
          color="text-sky-600"
          value={formatRM(totals.capital)}
        />
        <SummaryCard
          label="Total Dividends"
          color="text-emerald-600"
          value={formatRM(totals.dividend)}
        />
        <SummaryCard
          label="Total Value"
          color="text-indigo-600"
          value={formatRM(totals.total)}
        />
        <SummaryCard
          label="ROI (actual)"
          color="text-violet-600"
          value={`${totals.roi.toFixed(2)}%`}
        />
      </section>

      {/* Charts */}
      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        {/* Allocation */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#0b1222] flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-indigo-600" /> Allocation
            </h2>
            <p className="text-xs text-slate-500">Current total by account</p>
          </div>

          {allocationData.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">
              No allocation yet (add accounts / balances).
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={105}
                    paddingAngle={3}
                    label={({ name, value }) => `${name}: ${formatRM(value)}`}
                  >
                    {allocationData.map((x, i) => (
                      <Cell key={i} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatRM(value)}
                    contentStyle={{ borderRadius: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Projection */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#0b1222] flex items-center gap-2">
              <LineIcon className="w-5 h-5 text-sky-600" /> 12-Month Projection
            </h2>
            <p className="text-xs text-slate-500">
              Based on contributions + estimated returns
            </p>
          </div>

          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection12m}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  formatter={(v, k) => {
                    if (k === "value") return [formatRM(v), "Projected total"];
                    if (k === "add") return [formatRM(v), "Monthly add"];
                    if (k === "ret") return [formatRM(v), "Est. return"];
                    return [v, k];
                  }}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#0ea5e9"
                  fill="#0ea5e9"
                  fillOpacity={0.15}
                  name="Projected Total"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
            <MiniStat
              label="This month add"
              value={formatRM(projection12m?.[0]?.add || 0)}
              icon={<Wallet className="w-4 h-4 text-slate-700" />}
            />
            <MiniStat
              label="This month return"
              value={formatRM(projection12m?.[0]?.ret || 0)}
              icon={<PiggyBank className="w-4 h-4 text-slate-700" />}
            />
            <MiniStat
              label="12M total"
              value={formatRM(projection12m?.[11]?.value || totals.total)}
              icon={<LineIcon className="w-4 h-4 text-slate-700" />}
            />
          </div>
        </div>
      </section>

      {/* Accounts */}
      {status.loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading savings accounts...
        </div>
      ) : (
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {accounts.map((acc) => (
            <SavingsCard
              key={acc._id}
              acc={acc}
              busy={status.saving}
              onEdit={() => openEditAccount(acc)}
              onWithdraw={() => openWithdraw(acc)}
              onToggleAuto={() => toggleAutoSave(acc)}
              onDelete={() => openDelete(acc)}
            />
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
              No savings accounts yet. Click <b>Add Account</b> to create one.
            </div>
          )}
        </section>
      )}

      {/* ---------------------------- Add Account Modal ---------------------------- */}
      {addModal.open && (
        <Modal
          title="Add Savings Account"
          onClose={() => setAddModal((m) => ({ ...m, open: false }))}
        >
          {addModal.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3">
              {addModal.error}
            </div>
          )}

          <form onSubmit={createAccount} className="space-y-3">
            <Field label="Account Name">
              <input
                value={addModal.name}
                onChange={(e) =>
                  setAddModal((m) => ({
                    ...m,
                    name: e.target.value,
                    error: "",
                  }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="ASB / Versa-i / KWSP / Emergency Fund"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <input
                  type="color"
                  value={addModal.color}
                  onChange={(e) =>
                    setAddModal((m) => ({ ...m, color: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2 h-[42px]"
                />
              </Field>

              <Field label="Goal (RM)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={addModal.goal}
                  onChange={(e) =>
                    setAddModal((m) => ({ ...m, goal: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="5000"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting Balance (RM)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={addModal.initialCapital}
                  onChange={(e) =>
                    setAddModal((m) => ({
                      ...m,
                      initialCapital: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="10000"
                />
              </Field>

              <Field label="Expected Rate (% p.a.)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={addModal.ratePercent}
                  onChange={(e) =>
                    setAddModal((m) => ({ ...m, ratePercent: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="3.14"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Return Frequency">
                <select
                  value={addModal.returnFrequency}
                  onChange={(e) =>
                    setAddModal((m) => ({
                      ...m,
                      returnFrequency: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                >
                  {RETURN_FREQ.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Monthly Contribution (RM)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={addModal.monthlyContribution}
                  onChange={(e) =>
                    setAddModal((m) => ({
                      ...m,
                      monthlyContribution: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  placeholder="200"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-slate-600">
                <Settings className="w-4 h-4" />
                Auto Save
              </div>
              <button
                type="button"
                onClick={() =>
                  setAddModal((m) => ({ ...m, autoSave: !m.autoSave }))
                }
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  addModal.autoSave
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {addModal.autoSave ? "ON" : "OFF"}
              </button>
            </div>

            <Field label="Auto Amount (RM / month)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={addModal.autoAmount}
                onChange={(e) =>
                  setAddModal((m) => ({ ...m, autoAmount: e.target.value }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="200"
                disabled={!addModal.autoSave}
              />
            </Field>

            <button
              type="submit"
              disabled={status.saving}
              className="mt-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              {status.saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Account
            </button>
          </form>
        </Modal>
      )}

      {/* ---------------------------- Edit Account Modal ---------------------------- */}
      {editModal.open && (
        <Modal
          title={`Edit ${editModal.name || "Account"}`}
          onClose={() => setEditModal((m) => ({ ...m, open: false }))}
        >
          {editModal.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3">
              {editModal.error}
            </div>
          )}

          <form onSubmit={saveEditAccount} className="space-y-3">
            <Field label="Account Name">
              <input
                value={editModal.name}
                onChange={(e) =>
                  setEditModal((m) => ({
                    ...m,
                    name: e.target.value,
                    error: "",
                  }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Color">
                <input
                  type="color"
                  value={editModal.color}
                  onChange={(e) =>
                    setEditModal((m) => ({ ...m, color: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2 h-[42px]"
                />
              </Field>

              <Field label="Goal (RM)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editModal.goal}
                  onChange={(e) =>
                    setEditModal((m) => ({ ...m, goal: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starting Balance (RM)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editModal.initialCapital}
                  onChange={(e) =>
                    setEditModal((m) => ({
                      ...m,
                      initialCapital: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </Field>

              <Field label="Expected Rate (% p.a.)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editModal.ratePercent}
                  onChange={(e) =>
                    setEditModal((m) => ({ ...m, ratePercent: e.target.value }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Return Frequency">
                <select
                  value={editModal.returnFrequency}
                  onChange={(e) =>
                    setEditModal((m) => ({
                      ...m,
                      returnFrequency: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2 bg-white"
                >
                  {RETURN_FREQ.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Monthly Contribution (RM)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  value={editModal.monthlyContribution}
                  onChange={(e) =>
                    setEditModal((m) => ({
                      ...m,
                      monthlyContribution: e.target.value,
                    }))
                  }
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-slate-600">
                <Settings className="w-4 h-4" />
                Auto Save
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditModal((m) => ({ ...m, autoSave: !m.autoSave }))
                }
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  editModal.autoSave
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {editModal.autoSave ? "ON" : "OFF"}
              </button>
            </div>

            <Field label="Auto Amount (RM / month)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={editModal.autoAmount}
                onChange={(e) =>
                  setEditModal((m) => ({ ...m, autoAmount: e.target.value }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
                disabled={!editModal.autoSave}
              />
            </Field>

            <button
              type="submit"
              disabled={status.saving}
              className="mt-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              {status.saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </form>
        </Modal>
      )}

      {/* ---------------------------- Withdraw Modal ---------------------------- */}
      {withdrawModal.open && (
        <Modal
          title={`Withdraw from ${withdrawModal.name}`}
          onClose={() => setWithdrawModal((m) => ({ ...m, open: false }))}
        >
          {withdrawModal.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3">
              {withdrawModal.error}
            </div>
          )}

          <form onSubmit={confirmWithdraw} className="space-y-3">
            <Field label="Amount to Withdraw (RM)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={withdrawModal.amount}
                onChange={(e) =>
                  setWithdrawModal((m) => ({
                    ...m,
                    amount: e.target.value,
                    error: "",
                  }))
                }
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="100"
              />
            </Field>

            <button
              type="submit"
              disabled={status.saving}
              className="mt-2 bg-gradient-to-r from-red-500 to-rose-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2"
            >
              {status.saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <MinusCircle className="w-4 h-4" />
              )}
              Confirm Withdraw
            </button>
          </form>
        </Modal>
      )}

      {/* ---------------------------- Delete Confirm Modal ---------------------------- */}
      {deleteModal.open && (
        <Modal
          title="Delete Account"
          onClose={() =>
            setDeleteModal({ open: false, id: null, name: "", error: "" })
          }
        >
          {deleteModal.error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3">
              {deleteModal.error}
            </div>
          )}

          <p className="text-sm text-slate-700">
            Are you sure you want to delete <b>{deleteModal.name}</b>? <br />
            This will remove the account and its history.
          </p>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() =>
                setDeleteModal({ open: false, id: null, name: "", error: "" })
              }
              className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={status.saving}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-2"
            >
              {status.saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/* ----------------------------- UI Components ------------------------------ */
const SummaryCard = ({ label, color, value }) => (
  <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
    <p className="text-gray-500 text-sm">{label}</p>
    <h2 className={`text-2xl font-semibold ${color}`}>{value}</h2>
  </div>
);

const MiniStat = ({ label, value, icon }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
    <div className="p-2 rounded-lg bg-white border border-slate-200">
      {icon}
    </div>
    <div>
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="text-xs font-semibold text-slate-800">{value}</p>
    </div>
  </div>
);

const SavingsCard = ({
  acc,
  onEdit,
  onWithdraw,
  onToggleAuto,
  onDelete,
  busy,
}) => {
  const goal = safeNumber(acc.goal, 0);
  const capital = safeNumber(acc.capital, 0);
  const dividend = safeNumber(acc.dividend, 0);

  const rate = safeNumber(acc.ratePercent, 0);
  const freq = acc.returnFrequency || "daily";

  const est = estimateReturn(capital, rate, freq);
  const estLabel =
    freq === "daily"
      ? "≈ per day"
      : freq === "weekly"
      ? "≈ per week"
      : freq === "monthly"
      ? "≈ per month"
      : "≈ per year";

  const totalValue = capital + dividend;
  const roi = capital > 0 ? (dividend / capital) * 100 : 0;
  const progress = goal > 0 ? Math.min((capital / goal) * 100, 100) : 0;

  return (
    <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-md p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${acc.color || "#0ea5e9"}25` }}
          >
            <PiggyBank
              className="w-5 h-5"
              style={{ color: acc.color || "#0ea5e9" }}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[#0b1222]">{acc.name}</h3>
            <p className="text-xs text-slate-500">
              {rate > 0 ? `${rate.toFixed(2)}% p.a.` : "No rate set"} •{" "}
              <span className="font-medium">{freq.toUpperCase()}</span>
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="p-2 bg-sky-50 text-sky-700 rounded-lg hover:bg-sky-100 transition"
            type="button"
            disabled={busy}
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={onWithdraw}
            className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition"
            type="button"
            disabled={busy}
            title="Withdraw"
          >
            <MinusCircle className="w-4 h-4" />
          </button>

          <button
            onClick={onDelete}
            className="p-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            type="button"
            disabled={busy}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Capital</span>
          <span className="font-semibold text-blue-600">
            {formatRM(capital)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Dividends (actual)</span>
          <span className="font-semibold text-emerald-600">
            {formatRM(dividend)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total Value</span>
          <span className="font-semibold text-indigo-700">
            {formatRM(totalValue)}
          </span>
        </div>

        <div className="rounded-xl border bg-slate-50 px-3 py-2 mt-2">
          <p className="text-xs text-slate-600">Estimated return</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatRM(est)}{" "}
            <span className="text-xs text-slate-500">{estLabel}</span>
          </p>
        </div>

        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>ROI (actual)</span>
          <span className="font-semibold text-slate-700">
            {roi.toFixed(2)}%
          </span>
        </div>

        <p className="text-sm text-gray-500 mt-2">Goal Progress</p>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="h-2 bg-gradient-to-r from-blue-400 to-sky-600 rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-right">
          {goal > 0
            ? `${progress.toFixed(1)}% of ${formatRM(goal)}`
            : "No goal set"}
        </p>
      </div>

      <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
        <div className="flex items-center gap-2 text-gray-500">
          <Settings className="w-4 h-4" /> Auto Save
        </div>
        <button
          onClick={onToggleAuto}
          className={`px-3 py-1 rounded-lg text-sm font-medium ${
            acc.autoSave
              ? "bg-emerald-100 text-emerald-700"
              : "bg-gray-100 text-gray-500"
          }`}
          type="button"
          disabled={busy}
        >
          {acc.autoSave ? "ON" : "OFF"}
        </button>
      </div>
    </div>
  );
};

const Modal = ({ title, children, onClose }) => (
  <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block text-sm text-gray-700">
    {label}
    {children}
  </label>
);
