// src/pages/Savings.jsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  ArrowUpCircle,
  Trophy,
  Download,
  Calendar,
  Repeat,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
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

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */
const API = {
  ACCOUNTS: "/api/savings/accounts",
  TX: "/api/savings/transactions",
  TX_BY_ID: (id) => `/api/savings/transactions/${id}`,
  RULES: "/api/savings/recurring-rules",
  RULE_BY_ID: (id) => `/api/savings/recurring-rules/${id}`,
  RULE_GENERATE_MISSING: "/api/savings/recurring-rules/generate-missing",
  EXPORT_TX: "/api/savings/export/transactions",
  EXPORT_ACCOUNTS: "/api/savings/export/accounts",
  EXPORT_YEARLY: "/api/savings/export/yearly-summary",
};

async function apiFetch(path, options = {}) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error("Missing VITE_API_URL in frontend .env");

  const token = localStorage.getItem("token");

  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    signal: options.signal, // ✅ Support AbortSignal
  });

  // ✅ Handle 401 Unauthorized
  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Session expired. Please login again.");
  }

  // For CSV download (blob)
  if (options.expectBlob) {
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Export failed");
    }
    return { blob: await res.blob(), res };
  }

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

/* -------------------------------------------------------------------------- */
/*                               Helpers / Utils                              */
/* -------------------------------------------------------------------------- */

const MONTHS = [
  { value: 1, label: "Jan" },
  { value: 2, label: "Feb" },
  { value: 3, label: "Mar" },
  { value: 4, label: "Apr" },
  { value: 5, label: "May" },
  { value: 6, label: "Jun" },
  { value: 7, label: "Jul" },
  { value: 8, label: "Aug" },
  { value: 9, label: "Sep" },
  { value: 10, label: "Oct" },
  { value: 11, label: "Nov" },
  { value: 12, label: "Dec" },
];

const RETURN_FREQ = [
  {
    value: "daily_working",
    label: "Daily (working days, 252/yr) • Versa-i style",
  },
  { value: "daily_calendar", label: "Daily (calendar, 365/yr)" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly (ASB/KWSP)" },
];

const WORKING_DAYS_PER_YEAR = 252;
const CALENDAR_DAYS_PER_YEAR = 365;
const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

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

function yyyymmToLabel(year, month) {
  const m = MONTHS.find((x) => x.value === month)?.label || String(month);
  return `${m} ${year}`;
}

function getNowYM() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function isHexColor(v) {
  return typeof v === "string" && /^#([0-9a-fA-F]{6})$/.test(v);
}

function clampInt(n, min, max) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(Math.max(x, min), max);
}

function buildYearsList(startYear = 2020, yearsAhead = 1) {
  const now = new Date();
  const end = now.getFullYear() + yearsAhead;
  const out = [];
  for (let y = end; y >= startYear; y--) out.push(y);
  return out;
}

// ✅ Validate day for month/year
function isValidDay(year, month, day) {
  if (!day) return true;
  const maxDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDay;
}

// ✅ Validate decimal input (max 2 decimal places)
function isValidDecimal(value) {
  if (!value) return true;
  return /^\d*\.?\d{0,2}$/.test(value);
}

function estimateReturn(
  baseBalance,
  ratePercent,
  freq,
  workingDays = WORKING_DAYS_PER_YEAR,
) {
  const cap = safeNumber(baseBalance, 0);
  const rate = safeNumber(ratePercent, 0);
  if (cap <= 0 || rate <= 0) return 0;

  const annual = cap * (rate / 100);

  switch (freq) {
    case "daily_working":
      return annual / workingDays;
    case "daily_calendar":
      return annual / CALENDAR_DAYS_PER_YEAR;
    case "weekly":
      return annual / WEEKS_PER_YEAR;
    case "monthly":
      return annual / MONTHS_PER_YEAR;
    case "yearly":
    default:
      return annual;
  }
}

function buildProjection12M(accounts, opts = {}) {
  const { workingDays = WORKING_DAYS_PER_YEAR } = opts;
  const months = [];
  const now = new Date();

  let totalValue = accounts.reduce(
    (sum, a) => sum + safeNumber(a.currentBalance),
    0,
  );

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const label = d.toLocaleString("en", { month: "short" });

    const monthlyAdd = accounts.reduce(
      (sum, a) => sum + safeNumber(a.monthlyContribution),
      0,
    );

    const monthlyReturn = accounts.reduce((sum, a) => {
      const base = safeNumber(a.currentBalance);
      const rate = safeNumber(a.ratePercent);
      const freq = a.returnFrequency || "daily_working";
      const periodic = estimateReturn(base, rate, freq, workingDays);

      if (freq === "daily_working") return sum + periodic * 21;
      if (freq === "daily_calendar") return sum + periodic * 30;
      if (freq === "weekly") return sum + periodic * 4.345;
      if (freq === "monthly") return sum + periodic;
      return sum + periodic / 12;
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

function txTypeLabel(t) {
  if (t === "capital_add") return "Capital Add";
  if (t === "dividend") return "Dividend/Interest";
  if (t === "withdrawal") return "Withdrawal";
  return t || "Unknown";
}

function statusBadge(status) {
  if (status === "completed")
    return { text: "Completed", cls: "bg-emerald-100 text-emerald-700" };
  return { text: "Pending", cls: "bg-amber-100 text-amber-800" };
}

function sourceBadge(source) {
  if (source === "recurring")
    return { text: "Recurring", cls: "bg-indigo-100 text-indigo-700" };
  return { text: "Manual", cls: "bg-slate-100 text-slate-700" };
}

function isoFromYMD(year, month, day) {
  const d = new Date(
    Date.UTC(year, month - 1, clampInt(day || 1, 1, 31), 0, 0, 0),
  );
  return d.toISOString();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*                                  Main Page                                 */
/* -------------------------------------------------------------------------- */

export default function SavingsPage() {
  const didHydrateRef = useRef(false);
  const toastTimeoutRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [status, setStatus] = useState({
    loading: true,
    busy: false,
    error: "",
    offlineSaveError: false,
  });

  const nowYM = useMemo(() => getNowYM(), []);
  const [filter, setFilter] = useState({
    year: nowYM.year,
    month: nowYM.month,
    accountId: "all",
    viewMode: "month",
  });

  const [accounts, setAccounts] = useState([]);
  const [rulesByAccount, setRulesByAccount] = useState({});
  const [tx, setTx] = useState([]);
  const [pendingTx, setPendingTx] = useState([]);

  const [toast, setToast] = useState({ show: false, msg: "", tone: "info" });

  // ✅ Fixed toast with cleanup
  const showToast = useCallback((msg, tone = "info") => {
    setToast({ show: true, msg, tone });

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, msg: "", tone: "info" });
    }, 2600);
  }, []);

  // ✅ Cleanup on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /* ------------------------------ Modals ------------------------------ */
  const [addModal, setAddModal] = useState({
    open: false,
    simpleMode: true,
    name: "",
    color: "#0ea5e9",
    goal: "",
    startingBalance: "",
    lifetimeDividends: "",
    ratePercent: "",
    returnFrequency: "daily_working",
    monthlyContribution: "",
    autoDepositReminder: false,
    recurringAmount: "",
    recurringDay: "5",
    recurringStartYear: nowYM.year,
    recurringStartMonth: nowYM.month,
    recurringHasEnd: false,
    recurringEndYear: nowYM.year,
    recurringEndMonth: nowYM.month,
    recurringMode: "pending",
    error: "",
  });

  const [editModal, setEditModal] = useState({
    open: false,
    id: null,
    simpleMode: true,
    name: "",
    color: "#0ea5e9",
    goal: "",
    startingBalance: "",
    ratePercent: "",
    returnFrequency: "daily_working",
    monthlyContribution: "",
    autoDepositReminder: false,
    error: "",
  });

  const [txnModal, setTxnModal] = useState({
    open: false,
    accountId: null,
    accountName: "",
    type: "capital_add",
    year: nowYM.year,
    month: nowYM.month,
    day: "",
    amount: "",
    note: "",
    error: "",
  });

  const [ruleModal, setRuleModal] = useState({
    open: false,
    mode: "create",
    ruleId: null,
    accountId: null,
    accountName: "",
    amount: "",
    dayOfMonth: "5",
    startYear: nowYM.year,
    startMonth: nowYM.month,
    hasEnd: false,
    endYear: nowYM.year,
    endMonth: nowYM.month,
    modeSetting: "pending",
    isActive: true,
    error: "",
  });

  const [deleteModal, setDeleteModal] = useState({
    open: false,
    id: null,
    name: "",
    error: "",
  });

  const [exportModal, setExportModal] = useState({
    open: false,
    exportType: "transactions",
    year: nowYM.year,
    accountId: "all",
    error: "",
    busy: false,
  });

  /* -------------------------------------------------------------------------- */
  /*                                  Loaders                                   */
  /* -------------------------------------------------------------------------- */

  async function loadAccountsAndRules(signal) {
    const accRes = await apiFetch(API.ACCOUNTS, { signal });
    const list = Array.isArray(accRes.accounts) ? accRes.accounts : [];
    setAccounts(list);

    const rulesMap = {};
    await Promise.all(
      list.map(async (a) => {
        try {
          const r = await apiFetch(
            `${API.RULES}?accountId=${encodeURIComponent(a._id)}`,
            { signal },
          );
          const rules = Array.isArray(r.rules) ? r.rules : [];
          const active = rules.find((x) => x.isActive) || rules[0];
          if (active) rulesMap[a._id] = active;
        } catch (e) {
          if (e.name !== "AbortError") {
            console.error("Failed to load rules:", e);
          }
        }
      }),
    );
    setRulesByAccount(rulesMap);
  }

  async function loadTransactionsForFilter(f, signal) {
    const qs = new URLSearchParams();
    qs.set("year", String(f.year));
    if (f.viewMode === "month" && f.month) qs.set("month", String(f.month));
    if (f.accountId && f.accountId !== "all")
      qs.set("accountId", String(f.accountId));

    const res = await apiFetch(`${API.TX}?${qs.toString()}`, { signal });
    const list = Array.isArray(res.transactions) ? res.transactions : [];
    setTx(list);
    setPendingTx(list.filter((t) => (t.status || "completed") === "pending"));
  }

  async function generateMissingRecurringIfAny(signal) {
    try {
      await apiFetch(API.RULE_GENERATE_MISSING, { method: "POST", signal });
    } catch (e) {
      if (e.name !== "AbortError") {
        console.error("Failed to generate recurring:", e);
      }
    }
  }

  // ✅ Fixed with AbortController
  async function loadAll() {
    // Cancel previous request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus((s) => ({
      ...s,
      loading: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await generateMissingRecurringIfAny(abortController.signal);
      await loadAccountsAndRules(abortController.signal);
      await loadTransactionsForFilter(filter, abortController.signal);
      didHydrateRef.current = true;
      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      if (e.name === "AbortError") {
        // Request was cancelled, ignore
        return;
      }
      setStatus((s) => ({
        ...s,
        loading: false,
        error: e?.message || "Failed to load savings.",
      }));
    }
  }

  useEffect(() => {
    didHydrateRef.current = false;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Fixed with AbortController
  useEffect(() => {
    if (!didHydrateRef.current) return;

    const abortController = new AbortController();

    (async () => {
      try {
        setStatus((s) => ({ ...s, loading: true, error: "" }));
        await loadTransactionsForFilter(filter, abortController.signal);
        setStatus((s) => ({ ...s, loading: false }));
      } catch (e) {
        if (e.name !== "AbortError") {
          setStatus((s) => ({
            ...s,
            loading: false,
            error: e?.message || "Failed to load.",
          }));
        }
      }
    })();

    return () => {
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.year, filter.month, filter.accountId, filter.viewMode]);

  /* -------------------------------------------------------------------------- */
  /*                               Derived Metrics                              */
  /* -------------------------------------------------------------------------- */

  const scopedAggByAccount = useMemo(() => {
    const map = {};
    for (const a of accounts) {
      map[a._id] = {
        accountId: a._id,
        accountName: a.name,
        capitalAdded: 0,
        dividends: 0,
        withdrawals: 0,
        contributedForROI: 0,
      };
    }

    for (const t of tx) {
      const aid = t.accountId;
      if (!map[aid]) continue;
      if ((t.status || "completed") !== "completed") continue;

      const type = t.type;
      const amt = safeNumber(t.amount, 0);

      if (type === "capital_add") {
        map[aid].capitalAdded += amt;
        map[aid].contributedForROI += amt;
      } else if (type === "dividend") {
        map[aid].dividends += amt;
      } else if (type === "withdrawal") {
        map[aid].withdrawals += amt;
      }
    }

    return map;
  }, [accounts, tx]);

  const totals = useMemo(() => {
    let contributed = 0;
    let dividend = 0;
    let withdrawn = 0;

    for (const k of Object.keys(scopedAggByAccount)) {
      contributed += scopedAggByAccount[k].contributedForROI;
      dividend += scopedAggByAccount[k].dividends;
      withdrawn += scopedAggByAccount[k].withdrawals;
    }

    const roi = contributed > 0 ? (dividend / contributed) * 100 : 0;

    return {
      capital: contributed,
      dividend,
      withdrawn,
      roi,
      netWorthValue: accounts.reduce(
        (sum, a) => sum + safeNumber(a.currentBalance),
        0,
      ),
    };
  }, [scopedAggByAccount, accounts]);

  const thisMonthStats = useMemo(() => {
    if (filter.viewMode !== "month" || !filter.month) return { add: 0, ret: 0 };
    return { add: totals.capital, ret: totals.dividend };
  }, [filter.viewMode, filter.month, totals.capital, totals.dividend]);

  const allocationData = useMemo(() => {
    return accounts
      .map((a) => {
        const value = safeNumber(a.currentBalance, 0);
        return {
          name: a.name || "Untitled",
          value,
          color: isHexColor(a.color) ? a.color : "#0ea5e9",
        };
      })
      .filter((x) => x.value > 0);
  }, [accounts]);

  const projection12m = useMemo(
    () => buildProjection12M(accounts, { workingDays: WORKING_DAYS_PER_YEAR }),
    [accounts],
  );

  /* -------------------------------------------------------------------------- */
  /*                                CRUD Actions                                */
  /* -------------------------------------------------------------------------- */

  function openAddAccount() {
    const { year, month } = getNowYM();
    setAddModal((m) => ({
      ...m,
      open: true,
      simpleMode: true,
      name: "",
      color: "#0ea5e9",
      goal: "",
      startingBalance: "",
      lifetimeDividends: "",
      ratePercent: "",
      returnFrequency: "daily_working",
      monthlyContribution: "",
      autoDepositReminder: false,
      recurringAmount: "",
      recurringDay: "5",
      recurringStartYear: year,
      recurringStartMonth: month,
      recurringHasEnd: false,
      recurringEndYear: year,
      recurringEndMonth: month,
      recurringMode: "pending",
      error: "",
    }));
  }

  async function createAccount(e) {
    e.preventDefault();

    const name = String(addModal.name || "").trim();
    if (!name) {
      return setAddModal((m) => ({ ...m, error: "Account name is required." }));
    }

    if (name.length > 100) {
      return setAddModal((m) => ({
        ...m,
        error: "Account name is too long (max 100 characters).",
      }));
    }

    const payload = {
      name,
      color: isHexColor(addModal.color) ? addModal.color : "#0ea5e9",
      goal: Math.max(safeNumber(addModal.goal, 0), 0),
      startingBalance: Math.max(safeNumber(addModal.startingBalance, 0), 0),
      ratePercent: Math.max(safeNumber(addModal.ratePercent, 0), 0),
      returnFrequency: addModal.returnFrequency || "daily_working",
      monthlyContribution: Math.max(
        safeNumber(addModal.monthlyContribution, 0),
        0,
      ),
      autoDepositReminder: !!addModal.autoDepositReminder,
    };

    const initialDiv = Math.max(safeNumber(addModal.lifetimeDividends, 0), 0);

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      const res = await apiFetch(API.ACCOUNTS, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = res.account;

      if (created?._id && initialDiv > 0) {
        await apiFetch(API.TX, {
          method: "POST",
          body: JSON.stringify({
            accountId: created._id,
            type: "dividend",
            amount: initialDiv,
            status: "completed",
            source: "manual",
            year: filter.year,
            month: filter.month || getNowYM().month,
            day: 1,
            dateISO: isoFromYMD(
              filter.year,
              filter.month || getNowYM().month,
              1,
            ),
            notes: "Initial total dividends received (lifetime)",
          }),
        });
      }

      if (
        created?._id &&
        addModal.autoDepositReminder &&
        safeNumber(addModal.recurringAmount, 0) > 0
      ) {
        const rPayload = {
          accountId: created._id,
          amount: Math.max(safeNumber(addModal.recurringAmount, 0), 0),
          frequency: "monthly",
          dayOfMonth: clampInt(addModal.recurringDay || 5, 1, 28),
          startYear: clampInt(addModal.recurringStartYear, 2000, 2100),
          startMonth: clampInt(addModal.recurringStartMonth, 1, 12),
          endYear: addModal.recurringHasEnd
            ? clampInt(addModal.recurringEndYear, 2000, 2100)
            : undefined,
          endMonth: addModal.recurringHasEnd
            ? clampInt(addModal.recurringEndMonth, 1, 12)
            : undefined,
          mode:
            addModal.recurringMode === "auto_confirm"
              ? "auto_confirm"
              : "pending",
          isActive: true,
        };
        try {
          await apiFetch(API.RULES, {
            method: "POST",
            body: JSON.stringify(rPayload),
          });
        } catch {
          // not fatal
        }
      }

      setAddModal((m) => ({ ...m, open: false }));
      showToast("Account created", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
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
      simpleMode: true,
      name: acc.name || "",
      color: acc.color || "#0ea5e9",
      goal: String(safeNumber(acc.goal)),
      startingBalance: String(safeNumber(acc.startingBalance)),
      ratePercent: String(safeNumber(acc.ratePercent)),
      returnFrequency: acc.returnFrequency || "daily_working",
      monthlyContribution: String(safeNumber(acc.monthlyContribution)),
      autoDepositReminder: !!acc.autoDepositReminder,
      error: "",
    });
  }

  async function saveEditAccount(e) {
    e.preventDefault();

    const name = String(editModal.name || "").trim();
    if (!name) {
      return setEditModal((m) => ({
        ...m,
        error: "Account name is required.",
      }));
    }

    if (name.length > 100) {
      return setEditModal((m) => ({
        ...m,
        error: "Account name is too long (max 100 characters).",
      }));
    }

    const payload = {
      name,
      color: isHexColor(editModal.color) ? editModal.color : "#0ea5e9",
      goal: Math.max(safeNumber(editModal.goal, 0), 0),
      startingBalance: Math.max(safeNumber(editModal.startingBalance, 0), 0),
      ratePercent: Math.max(safeNumber(editModal.ratePercent, 0), 0),
      returnFrequency: editModal.returnFrequency || "daily_working",
      monthlyContribution: Math.max(
        safeNumber(editModal.monthlyContribution, 0),
        0,
      ),
      autoDepositReminder: !!editModal.autoDepositReminder,
    };

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(`${API.ACCOUNTS}/${editModal.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setEditModal((m) => ({ ...m, open: false }));
      showToast("Account updated", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setEditModal((m) => ({
        ...m,
        error: e2?.message || "Failed to update account.",
      }));
    }
  }

  function openDelete(acc) {
    setDeleteModal({ open: true, id: acc._id, name: acc.name, error: "" });
  }

  async function confirmDelete() {
    if (!deleteModal.id) return;
    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      await apiFetch(`${API.ACCOUNTS}/${deleteModal.id}`, { method: "DELETE" });
      setDeleteModal({ open: false, id: null, name: "", error: "" });
      showToast("Account deleted", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setDeleteModal((m) => ({ ...m, error: e?.message || "Delete failed." }));
    }
  }

  function openTxn(acc, type) {
    const ym = getNowYM();
    setTxnModal({
      open: true,
      accountId: acc._id,
      accountName: acc.name,
      type,
      year: filter.year || ym.year,
      month: filter.month || ym.month,
      day: "",
      amount: "",
      note: "",
      error: "",
    });
  }

  async function saveTxn(e) {
    e.preventDefault();

    const amount = safeNumber(txnModal.amount, -1);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setTxnModal((m) => ({
        ...m,
        error: "Enter a valid amount (> 0).",
      }));
    }

    if (!isValidDecimal(txnModal.amount)) {
      return setTxnModal((m) => ({
        ...m,
        error: "Amount can have at most 2 decimal places.",
      }));
    }

    const year = clampInt(txnModal.year, 2000, 2100);
    const month = clampInt(txnModal.month, 1, 12);
    const day = txnModal.day ? clampInt(txnModal.day, 1, 31) : 1;

    if (txnModal.day && !isValidDay(year, month, day)) {
      return setTxnModal((m) => ({
        ...m,
        error: `Day ${day} is invalid for ${month}/${year}.`,
      }));
    }

    const payload = {
      accountId: txnModal.accountId,
      type: txnModal.type,
      amount,
      year,
      month,
      day: txnModal.day ? day : undefined,
      dateISO: isoFromYMD(year, month, day),
      status: "completed",
      source: "manual",
      notes: String(txnModal.note || "")
        .trim()
        .substring(0, 500),
    };

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));

    try {
      await apiFetch(API.TX, { method: "POST", body: JSON.stringify(payload) });
      setTxnModal((m) => ({ ...m, open: false }));
      showToast("Transaction saved", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setTxnModal((m) => ({
        ...m,
        error: err?.message || "Failed to save transaction.",
      }));
    }
  }

  async function confirmPendingTx(txn) {
    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      await apiFetch(API.TX_BY_ID(txn._id), {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      showToast("Marked as completed", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      showToast(e?.message || "Failed to confirm", "warn");
    }
  }

  function openRuleEditor(acc) {
    const existing = rulesByAccount[acc._id];
    if (existing) {
      setRuleModal({
        open: true,
        mode: "edit",
        ruleId: existing._id,
        accountId: acc._id,
        accountName: acc.name,
        amount: String(safeNumber(existing.amount)),
        dayOfMonth: String(clampInt(existing.dayOfMonth || 5, 1, 28)),
        startYear: clampInt(existing.startYear || nowYM.year, 2000, 2100),
        startMonth: clampInt(existing.startMonth || nowYM.month, 1, 12),
        hasEnd: !!(existing.endYear && existing.endMonth),
        endYear: clampInt(existing.endYear || nowYM.year, 2000, 2100),
        endMonth: clampInt(existing.endMonth || nowYM.month, 1, 12),
        modeSetting:
          existing.mode === "auto_confirm" ? "auto_confirm" : "pending",
        isActive: existing.isActive !== false,
        error: "",
      });
    } else {
      setRuleModal({
        open: true,
        mode: "create",
        ruleId: null,
        accountId: acc._id,
        accountName: acc.name,
        amount: "",
        dayOfMonth: "5",
        startYear: nowYM.year,
        startMonth: nowYM.month,
        hasEnd: false,
        endYear: nowYM.year,
        endMonth: nowYM.month,
        modeSetting: "pending",
        isActive: true,
        error: "",
      });
    }
  }

  async function saveRule(e) {
    e.preventDefault();

    const amount = safeNumber(ruleModal.amount, -1);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setRuleModal((m) => ({ ...m, error: "Enter amount > 0" }));
    }

    if (!isValidDecimal(ruleModal.amount)) {
      return setRuleModal((m) => ({
        ...m,
        error: "Amount can have at most 2 decimal places.",
      }));
    }

    const payload = {
      accountId: ruleModal.accountId,
      amount: Math.max(amount, 0),
      frequency: "monthly",
      dayOfMonth: clampInt(ruleModal.dayOfMonth || 5, 1, 28),
      startYear: clampInt(ruleModal.startYear, 2000, 2100),
      startMonth: clampInt(ruleModal.startMonth, 1, 12),
      endYear: ruleModal.hasEnd
        ? clampInt(ruleModal.endYear, 2000, 2100)
        : undefined,
      endMonth: ruleModal.hasEnd
        ? clampInt(ruleModal.endMonth, 1, 12)
        : undefined,
      mode:
        ruleModal.modeSetting === "auto_confirm" ? "auto_confirm" : "pending",
      isActive: !!ruleModal.isActive,
    };

    if (payload.mode === "auto_confirm") {
      showToast("Auto-confirm assumes you deposited. Use carefully.", "warn");
    }

    setStatus((s) => ({
      ...s,
      busy: true,
      error: "",
      offlineSaveError: false,
    }));
    try {
      if (ruleModal.mode === "edit" && ruleModal.ruleId) {
        await apiFetch(API.RULE_BY_ID(ruleModal.ruleId), {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(API.RULES, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setRuleModal((m) => ({ ...m, open: false }));
      showToast("Recurring rule saved", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false, offlineSaveError: true }));
      setRuleModal((m) => ({
        ...m,
        error: err?.message || "Failed to save rule.",
      }));
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Export                                   */
  /* -------------------------------------------------------------------------- */

  function openExport() {
    setExportModal((m) => ({
      ...m,
      open: true,
      exportType: "transactions",
      year: filter.year,
      accountId: filter.accountId,
      error: "",
      busy: false,
    }));
  }

  async function runExport(e) {
    e.preventDefault();
    setExportModal((m) => ({ ...m, busy: true, error: "" }));

    try {
      const year = clampInt(exportModal.year, 2000, 2100);
      const accountId = exportModal.accountId || "all";

      const qs = new URLSearchParams();
      if (exportModal.exportType !== "accounts") qs.set("year", String(year));
      if (accountId !== "all") qs.set("accountId", accountId);

      let endpoint = API.EXPORT_TX;
      let filename = `savings_transactions_${year}.csv`;

      if (exportModal.exportType === "accounts") {
        endpoint = API.EXPORT_ACCOUNTS;
        filename = `savings_accounts_summary.csv`;
        qs.delete("year");
      } else if (exportModal.exportType === "yearly") {
        endpoint = API.EXPORT_YEARLY;
        filename = `savings_yearly_summary_${year}.csv`;
      }

      const { blob, res } = await apiFetch(`${endpoint}?${qs.toString()}`, {
        expectBlob: true,
      });

      if (blob.size === 0) {
        setExportModal((m) => ({
          ...m,
          busy: false,
          error: "No data found for this selection.",
        }));
        return;
      }

      const cd = res.headers.get("Content-Disposition") || "";
      const match = cd.match(/filename="?([^"]+)"?/i);
      if (match?.[1]) filename = match[1];

      downloadBlob(blob, filename);
      setExportModal((m) => ({ ...m, open: false, busy: false }));
      showToast("CSV download started", "ok");
    } catch (err) {
      setExportModal((m) => ({
        ...m,
        busy: false,
        error: err?.message || "Export failed.",
      }));
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                     UI                                     */
  /* -------------------------------------------------------------------------- */

  const years = useMemo(() => buildYearsList(2020, 1), []);

  // ✅ Keyboard support for modals
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        if (addModal.open) setAddModal((m) => ({ ...m, open: false }));
        if (editModal.open) setEditModal((m) => ({ ...m, open: false }));
        if (txnModal.open) setTxnModal((m) => ({ ...m, open: false }));
        if (ruleModal.open) setRuleModal((m) => ({ ...m, open: false }));
        if (deleteModal.open) setDeleteModal((m) => ({ ...m, open: false }));
        if (exportModal.open) setExportModal((m) => ({ ...m, open: false }));
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [
    addModal.open,
    editModal.open,
    txnModal.open,
    ruleModal.open,
    deleteModal.open,
    exportModal.open,
  ]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf4ff] to-[#e5edff] px-4 sm:px-6 md:px-10 lg:px-12 py-8 font-inter overflow-hidden">
      {/* Header */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0b1222]">
              Savings Tracker
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1">
              Net-worth ready savings tracking with month/year history,
              withdrawals, recurring reminders, and CSV export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => loadAll()}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition disabled:opacity-50 disabled:cursor-not-allowed"
              type="button"
              disabled={status.busy || status.loading}
              aria-label="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 text-slate-700 ${status.loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              onClick={openExport}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
              type="button"
              aria-label="Export to CSV"
            >
              <Download className="w-4 h-4 text-slate-700" />
              Export CSV
            </button>

            <button
              onClick={openAddAccount}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.02] transition"
              type="button"
              aria-label="Add new account"
            >
              <Plus className="w-4 h-4" /> Add Account
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white/85 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-3 sm:p-4">
          <div className="flex flex-col lg:flex-row lg:items-center gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                View:
              </span>

              <Segment
                value={filter.viewMode}
                onChange={(v) =>
                  setFilter((f) => ({
                    ...f,
                    viewMode: v,
                    month: v === "year" ? 0 : f.month || getNowYM().month,
                  }))
                }
                options={[
                  { value: "month", label: "Month" },
                  { value: "year", label: "Year" },
                ]}
              />

              <select
                value={filter.year}
                onChange={(e) =>
                  setFilter((f) => ({
                    ...f,
                    year: clampInt(e.target.value, 2000, 2100),
                  }))
                }
                className={FILTER_SELECT}
                aria-label="Select year"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {filter.viewMode === "month" && (
                <select
                  value={filter.month}
                  onChange={(e) =>
                    setFilter((f) => ({
                      ...f,
                      month: clampInt(e.target.value, 1, 12),
                    }))
                  }
                  className={FILTER_SELECT}
                  aria-label="Select month"
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              )}

              <div className="h-6 w-px bg-slate-200 mx-1 hidden sm:block" />

              <select
                value={filter.accountId}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, accountId: e.target.value }))
                }
                className={`${FILTER_SELECT} min-w-[180px]`}
                aria-label="Select account"
              >
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1" />

            <div className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-700">
                {filter.viewMode === "month"
                  ? yyyymmToLabel(filter.year, filter.month || nowYM.month)
                  : `Year ${filter.year}`}
              </span>{" "}
              {filter.accountId !== "all"
                ? "• Selected account only"
                : "• All accounts"}
            </div>
          </div>
        </div>
      </header>

      {(status.error || status.offlineSaveError) && (
        <div
          className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 flex items-center gap-2"
          role="alert"
        >
          <CloudOff className="w-4 h-4" />
          {status.error || "Backend request failed. Check server + token."}
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]"
          role="alert"
          aria-live="polite"
        >
          <div
            className={`rounded-2xl px-4 py-3 shadow-lg border text-sm flex items-center gap-2 ${
              toast.tone === "ok"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : toast.tone === "warn"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-slate-50 border-slate-200 text-slate-800"
            }`}
          >
            {toast.tone === "ok" ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {toast.msg}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <SummaryCard
          label={
            filter.viewMode === "month"
              ? "Capital Added (this month)"
              : "Capital Added (this year)"
          }
          color="text-sky-600"
          value={formatRM(totals.capital)}
          sub="Actual (completed) transactions only"
        />
        <SummaryCard
          label={
            filter.viewMode === "month"
              ? "Dividends/Interest (this month)"
              : "Dividends/Interest (this year)"
          }
          color="text-emerald-600"
          value={formatRM(totals.dividend)}
          sub="Actual (completed) transactions only"
        />
        <SummaryCard
          label="Net Worth Value (current)"
          color="text-indigo-600"
          value={formatRM(totals.netWorthValue)}
          sub="Allocation uses current balances"
        />
        <SummaryCard
          label="ROI (actual)"
          color="text-violet-600"
          value={`${totals.roi.toFixed(2)}%`}
          sub="Dividends ÷ Contributed (completed, scoped)"
        />
      </section>

      {/* Charts */}
      <section className="grid lg:grid-cols-2 gap-6 sm:gap-8 mb-10">
        {/* Allocation */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-[#0b1222] flex items-center gap-2">
                <PieIcon className="w-5 h-5 text-indigo-600" /> Allocation
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Current net worth by account (balances, not projection).
              </p>
            </div>
            <div className="text-[11px] text-slate-500">
              Not affected by month/year filter
            </div>
          </div>

          {allocationData.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-slate-700">
              No allocation yet (add accounts / balances).
            </div>
          ) : (
            <div className="h-[260px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={allocationData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={100}
                    paddingAngle={3}
                    labelLine={false}
                  >
                    {allocationData.map((x, i) => (
                      <Cell key={i} fill={x.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatRM(value)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Projection */}
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-5 sm:p-6 shadow-lg">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-[#0b1222] flex items-center gap-2">
                <LineIcon className="w-5 h-5 text-sky-600" /> 12-Month
                Projection
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Projection only: uses monthly plan + expected rate.{" "}
                <span className="font-semibold">Never auto-adds</span> to actual
                values.
              </p>
            </div>
          </div>

          <div className="h-[260px] sm:h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={projection12m}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#94a3b8" />
                <Tooltip
                  formatter={(v, k) => {
                    if (k === "value") return [formatRM(v), "Projected total"];
                    if (k === "add") return [formatRM(v), "Monthly plan add"];
                    if (k === "ret") return [formatRM(v), "Estimated return"];
                    return [v, k];
                  }}
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

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <MiniStat
              label={
                filter.viewMode === "month"
                  ? "This month add (actual)"
                  : "Selected period add (actual)"
              }
              value={formatRM(thisMonthStats.add)}
              icon={<Wallet className="w-4 h-4 text-slate-700" />}
            />
            <MiniStat
              label={
                filter.viewMode === "month"
                  ? "This month return (actual)"
                  : "Selected period return (actual)"
              }
              value={formatRM(thisMonthStats.ret)}
              icon={<PiggyBank className="w-4 h-4 text-slate-700" />}
            />
            <MiniStat
              label="12M projected total"
              value={formatRM(
                projection12m?.[11]?.value || totals.netWorthValue,
              )}
              icon={<LineIcon className="w-4 h-4 text-slate-700" />}
            />
          </div>
        </div>
      </section>

      {/* Pending Recurring Deposits */}
      <section className="mb-10">
        <div className="bg-white/85 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#0b1222] flex items-center gap-2">
                <Repeat className="w-5 h-5 text-indigo-600" /> Pending Recurring
                Deposits
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Recurring reminders create <b>pending</b> records. Confirm only
                if you really deposited.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              Scope:{" "}
              {filter.viewMode === "month"
                ? yyyymmToLabel(filter.year, filter.month || nowYM.month)
                : `Year ${filter.year}`}
            </div>
          </div>

          {status.loading ? (
            <div className="mt-4 flex items-center gap-2 text-slate-600 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          ) : pendingTx.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
              No pending recurring deposits in this view.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {pendingTx.slice(0, 12).map((t) => (
                <div
                  key={t._id}
                  className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {t.accountName ||
                        accounts.find((a) => a._id === t.accountId)?.name ||
                        "Account"}{" "}
                      •{" "}
                      <span className="text-slate-600 font-medium">
                        {txTypeLabel(t.type)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {yyyymmToLabel(t.year, t.month)} • Amount:{" "}
                      <b>{formatRM(t.amount)}</b>{" "}
                      {t.source === "recurring" ? "• Recurring" : ""}{" "}
                      {t.notes ? `• ${t.notes}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${statusBadge(t.status).cls}`}
                    >
                      {statusBadge(t.status).text}
                    </span>
                    <span
                      className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${sourceBadge(t.source).cls}`}
                    >
                      {sourceBadge(t.source).text}
                    </span>
                    <button
                      type="button"
                      disabled={status.busy}
                      onClick={() => confirmPendingTx(t)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Confirm (mark completed)"
                      aria-label="Confirm transaction"
                    >
                      {status.busy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Confirm
                    </button>
                  </div>
                </div>
              ))}

              {pendingTx.length > 12 && (
                <p className="text-xs text-slate-500 mt-2">
                  Showing first 12 pending items. Use filter to narrow down.
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Accounts */}
      {status.loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading savings accounts...
        </div>
      ) : (
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          {accounts.map((acc) => (
            <SavingsCard
              key={acc._id}
              acc={acc}
              busy={status.busy}
              rule={rulesByAccount[acc._id]}
              scopedAgg={scopedAggByAccount[acc._id]}
              onEdit={() => openEditAccount(acc)}
              onDelete={() => openDelete(acc)}
              onAddCapital={() => openTxn(acc, "capital_add")}
              onAddDividend={() => openTxn(acc, "dividend")}
              onWithdraw={() => openTxn(acc, "withdrawal")}
              onEditRule={() => openRuleEditor(acc)}
            />
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
              No savings accounts yet. Click <b>Add Account</b> to create one.
            </div>
          )}
        </section>
      )}

      {/* History List */}
      <section className="mt-10">
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[#0b1222]">
                History (Actual Transactions)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Shows your recorded history in the selected view. Pending
                entries are included and marked.
              </p>
            </div>

            <div className="text-xs text-slate-500">
              {filter.viewMode === "month"
                ? yyyymmToLabel(filter.year, filter.month || nowYM.month)
                : `Year ${filter.year}`}{" "}
              •{" "}
              {filter.accountId === "all" ? "All accounts" : "Selected account"}
            </div>
          </div>

          {tx.length === 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm">
              No transactions found for this filter.
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">#</th>
                    <th className="py-2 pr-4">Account</th>
                    <th className="py-2 pr-4">Year</th>
                    <th className="py-2 pr-4">Month</th>
                    <th className="py-2 pr-4">Type</th>
                    <th className="py-2 pr-4">Amount</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Source</th>
                    <th className="py-2 pr-4">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {tx
                    .slice()
                    .sort((a, b) => {
                      const ay = safeNumber(a.year),
                        am = safeNumber(a.month),
                        ad = safeNumber(a.day || 1);
                      const by = safeNumber(b.year),
                        bm = safeNumber(b.month),
                        bd = safeNumber(b.day || 1);
                      if (ay !== by) return by - ay;
                      if (am !== bm) return bm - am;
                      return bd - ad;
                    })
                    .map((t, idx) => (
                      <tr
                        key={t._id || idx}
                        className="border-b last:border-b-0"
                      >
                        <td className="py-2 pr-4 text-slate-500">{idx + 1}</td>
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {t.accountName ||
                            accounts.find((a) => a._id === t.accountId)?.name ||
                            "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">{t.year}</td>
                        <td className="py-2 pr-4 text-slate-500">
                          {MONTHS.find((m) => m.value === t.month)?.label ||
                            t.month}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">
                          {txTypeLabel(t.type)}
                        </td>
                        <td className="py-2 pr-4 text-slate-500">
                          {formatRM(t.amount)}
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${statusBadge(t.status).cls}`}
                          >
                            {statusBadge(t.status).text}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold ${sourceBadge(t.source).cls}`}
                          >
                            {sourceBadge(t.source).text}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {t.notes || "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 text-[11px] text-slate-500">
            Projection values are <b>not</b> part of history and are never
            exported as actual transactions.
          </div>
        </div>
      </section>

      {/* ------------------------------ Modals ------------------------------ */}

      {/* Add Account Modal */}
      {addModal.open && (
        <Modal
          title="Add Savings Account"
          onClose={() => setAddModal((m) => ({ ...m, open: false }))}
        >
          {addModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {addModal.error}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-600 font-semibold">Mode</div>
            <Segment
              value={addModal.simpleMode ? "simple" : "advanced"}
              onChange={(v) =>
                setAddModal((m) => ({ ...m, simpleMode: v === "simple" }))
              }
              options={[
                { value: "simple", label: "Simple" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
          </div>

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
                className={`mt-1 ${SELECT_UI}`}
                placeholder="ASB / Versa-i / Bank / Emergency Fund"
                maxLength={100}
                required
                aria-required="true"
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
                  min="0"
                  max="999999999"
                  value={addModal.goal}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setAddModal((m) => ({ ...m, goal: e.target.value }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
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
                  min="0"
                  max="999999999"
                  value={addModal.startingBalance}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setAddModal((m) => ({
                        ...m,
                        startingBalance: e.target.value,
                      }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="10000"
                />
              </Field>

              {!addModal.simpleMode && (
                <Field label="Total Dividends Received (lifetime) (RM)">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    max="999999999"
                    value={addModal.lifetimeDividends}
                    onChange={(e) => {
                      if (isValidDecimal(e.target.value)) {
                        setAddModal((m) => ({
                          ...m,
                          lifetimeDividends: e.target.value,
                        }));
                      }
                    }}
                    className={`mt-1 ${SELECT_UI}`}
                    placeholder="120"
                  />
                </Field>
              )}
            </div>

            {!addModal.simpleMode && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expected Rate (% p.a.)">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="100"
                      value={addModal.ratePercent}
                      onChange={(e) => {
                        if (isValidDecimal(e.target.value)) {
                          setAddModal((m) => ({
                            ...m,
                            ratePercent: e.target.value,
                          }));
                        }
                      }}
                      className={`mt-1 ${SELECT_UI}`}
                      placeholder="3.14"
                    />
                  </Field>

                  <Field label="Return Frequency">
                    <select
                      value={addModal.returnFrequency}
                      onChange={(e) =>
                        setAddModal((m) => ({
                          ...m,
                          returnFrequency: e.target.value,
                        }))
                      }
                      className={`mt-1 ${SELECT_UI}`}
                    >
                      {RETURN_FREQ.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}

            <Field label="Monthly Contribution Plan (RM) • Projection only">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="999999999"
                value={addModal.monthlyContribution}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setAddModal((m) => ({
                      ...m,
                      monthlyContribution: e.target.value,
                    }));
                  }
                }}
                className={`mt-1 ${SELECT_UI}`}
                placeholder="200"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Projection only (planning). It does <b>not</b> auto-add money.
                Record actual top-ups using "+ Capital".
              </p>
            </Field>

            {/* Auto Deposit Reminder (Recurring Rule) */}
            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-700">
                  <Repeat className="w-4 h-4" />
                  <div>
                    <p className="text-sm font-semibold">
                      Auto Deposit Reminder
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Creates recurring deposit entries (no bank integration).
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAddModal((m) => ({
                      ...m,
                      autoDepositReminder: !m.autoDepositReminder,
                    }))
                  }
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    addModal.autoDepositReminder
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                  aria-label="Toggle auto deposit reminder"
                >
                  {addModal.autoDepositReminder ? "ON" : "OFF"}
                </button>
              </div>

              {addModal.autoDepositReminder && (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Recurring Amount (RM/month)">
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        max="999999999"
                        value={addModal.recurringAmount}
                        onChange={(e) => {
                          if (isValidDecimal(e.target.value)) {
                            setAddModal((m) => ({
                              ...m,
                              recurringAmount: e.target.value,
                            }));
                          }
                        }}
                        className={`mt-1 ${SELECT_UI}`}
                        placeholder="100"
                      />
                    </Field>

                    <Field label="Day of Month (1-28)">
                      <input
                        type="number"
                        min="1"
                        max="28"
                        value={addModal.recurringDay}
                        onChange={(e) =>
                          setAddModal((m) => ({
                            ...m,
                            recurringDay: e.target.value,
                          }))
                        }
                        className={`mt-1 ${SELECT_UI}`}
                        placeholder="5"
                      />
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start (Year)">
                      <select
                        value={addModal.recurringStartYear}
                        onChange={(e) =>
                          setAddModal((m) => ({
                            ...m,
                            recurringStartYear: clampInt(
                              e.target.value,
                              2000,
                              2100,
                            ),
                          }))
                        }
                        className={`mt-1 ${SELECT_UI}`}
                      >
                        {years
                          .slice()
                          .reverse()
                          .map((y) => (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Start (Month)">
                      <select
                        value={addModal.recurringStartMonth}
                        onChange={(e) =>
                          setAddModal((m) => ({
                            ...m,
                            recurringStartMonth: clampInt(
                              e.target.value,
                              1,
                              12,
                            ),
                          }))
                        }
                        className={`mt-1 ${SELECT_UI}`}
                      >
                        {MONTHS.map((mm) => (
                          <option key={mm.value} value={mm.value}>
                            {mm.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="text-sm text-slate-700 font-medium">
                      End month (optional)
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setAddModal((m) => ({
                          ...m,
                          recurringHasEnd: !m.recurringHasEnd,
                        }))
                      }
                      className={`px-3 py-1 rounded-lg text-sm font-medium ${
                        addModal.recurringHasEnd
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-700"
                      }`}
                      aria-label="Toggle end date"
                    >
                      {addModal.recurringHasEnd ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  {addModal.recurringHasEnd && (
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="End (Year)">
                        <select
                          value={addModal.recurringEndYear}
                          onChange={(e) =>
                            setAddModal((m) => ({
                              ...m,
                              recurringEndYear: clampInt(
                                e.target.value,
                                2000,
                                2100,
                              ),
                            }))
                          }
                          className={`mt-1 ${SELECT_UI}`}
                        >
                          {years
                            .slice()
                            .reverse()
                            .map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="End (Month)">
                        <select
                          value={addModal.recurringEndMonth}
                          onChange={(e) =>
                            setAddModal((m) => ({
                              ...m,
                              recurringEndMonth: clampInt(
                                e.target.value,
                                1,
                                12,
                              ),
                            }))
                          }
                          className={`mt-1 ${SELECT_UI}`}
                        >
                          {MONTHS.map((mm) => (
                            <option key={mm.value} value={mm.value}>
                              {mm.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                  )}

                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="text-xs text-amber-800 font-semibold">
                      Deposit creation mode
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setAddModal((m) => ({
                            ...m,
                            recurringMode: "pending",
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          addModal.recurringMode === "pending"
                            ? "bg-amber-600 text-white"
                            : "bg-white border border-amber-200 text-amber-800"
                        }`}
                      >
                        Pending (recommended)
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setAddModal((m) => ({
                            ...m,
                            recurringMode: "auto_confirm",
                          }))
                        }
                        className={`px-3 py-1 rounded-lg text-sm font-medium ${
                          addModal.recurringMode === "auto_confirm"
                            ? "bg-rose-600 text-white"
                            : "bg-white border border-rose-200 text-rose-700"
                        }`}
                      >
                        Auto-confirm (assumes deposited)
                      </button>
                    </div>
                    <p className="text-[11px] text-amber-800 mt-2">
                      Auto-confirm will create completed records automatically.
                      Use carefully.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className="mt-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Create Account
            </button>
          </form>
        </Modal>
      )}

      {/* Edit Account Modal */}
      {editModal.open && (
        <Modal
          title={`Edit ${editModal.name || "Account"}`}
          onClose={() => setEditModal((m) => ({ ...m, open: false }))}
        >
          {editModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {editModal.error}
            </div>
          )}

          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-slate-600 font-semibold">Mode</div>
            <Segment
              value={editModal.simpleMode ? "simple" : "advanced"}
              onChange={(v) =>
                setEditModal((m) => ({ ...m, simpleMode: v === "simple" }))
              }
              options={[
                { value: "simple", label: "Simple" },
                { value: "advanced", label: "Advanced" },
              ]}
            />
          </div>

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
                className={`mt-1 ${SELECT_UI}`}
                maxLength={100}
                required
                aria-required="true"
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
                  min="0"
                  max="999999999"
                  value={editModal.goal}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setEditModal((m) => ({ ...m, goal: e.target.value }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                />
              </Field>
            </div>

            <Field label="Starting Balance (RM)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="999999999"
                value={editModal.startingBalance}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setEditModal((m) => ({
                      ...m,
                      startingBalance: e.target.value,
                    }));
                  }
                }}
                className={`mt-1 ${SELECT_UI}`}
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Starting balance affects net worth base, not ROI denominator.
              </p>
            </Field>

            {!editModal.simpleMode && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Expected Rate (% p.a.)">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="100"
                      value={editModal.ratePercent}
                      onChange={(e) => {
                        if (isValidDecimal(e.target.value)) {
                          setEditModal((m) => ({
                            ...m,
                            ratePercent: e.target.value,
                          }));
                        }
                      }}
                      className={`mt-1 ${SELECT_UI}`}
                    />
                  </Field>

                  <Field label="Return Frequency">
                    <select
                      value={editModal.returnFrequency}
                      onChange={(e) =>
                        setEditModal((m) => ({
                          ...m,
                          returnFrequency: e.target.value,
                        }))
                      }
                      className={`mt-1 ${SELECT_UI}`}
                    >
                      {RETURN_FREQ.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              </>
            )}

            <Field label="Monthly Contribution Plan (RM) • Projection only">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max="999999999"
                value={editModal.monthlyContribution}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setEditModal((m) => ({
                      ...m,
                      monthlyContribution: e.target.value,
                    }));
                  }
                }}
                className={`mt-1 ${SELECT_UI}`}
              />
            </Field>

            <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-3 py-2">
              <div className="flex items-center gap-2 text-slate-700">
                <Repeat className="w-4 h-4" />
                Auto Deposit Reminder
              </div>
              <button
                type="button"
                onClick={() =>
                  setEditModal((m) => ({
                    ...m,
                    autoDepositReminder: !m.autoDepositReminder,
                  }))
                }
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  editModal.autoDepositReminder
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-gray-100 text-gray-600"
                }`}
                aria-label="Toggle auto deposit reminder"
              >
                {editModal.autoDepositReminder ? "ON" : "OFF"}
              </button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              Tip: Edit recurring rule on the account card using{" "}
              <b>"Recurring Rule"</b>.
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className="mt-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pencil className="w-4 h-4" />
              )}
              Save Changes
            </button>
          </form>
        </Modal>
      )}

      {/* Transaction Modal (Capital / Dividend / Withdrawal) */}
      {txnModal.open && (
        <Modal
          title={
            txnModal.type === "capital_add"
              ? `Add Capital • ${txnModal.accountName}`
              : txnModal.type === "dividend"
                ? `Add Dividend/Interest • ${txnModal.accountName}`
                : `Withdraw • ${txnModal.accountName}`
          }
          onClose={() => setTxnModal((m) => ({ ...m, open: false }))}
        >
          {txnModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {txnModal.error}
            </div>
          )}

          <form onSubmit={saveTxn} className="space-y-3">
            <div className="rounded-xl border bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-600 font-semibold flex items-center gap-2">
                <Calendar className="w-4 h-4" /> Month-based entry (recommended)
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label="Year">
                  <select
                    value={txnModal.year}
                    onChange={(e) =>
                      setTxnModal((m) => ({
                        ...m,
                        year: clampInt(e.target.value, 2000, 2100),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    required
                  >
                    {years
                      .slice()
                      .reverse()
                      .map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="Month">
                  <select
                    value={txnModal.month}
                    onChange={(e) =>
                      setTxnModal((m) => ({
                        ...m,
                        month: clampInt(e.target.value, 1, 12),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                    required
                  >
                    {MONTHS.map((mm) => (
                      <option key={mm.value} value={mm.value}>
                        {mm.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>

              <Field label="Day (optional)">
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={txnModal.day}
                  onChange={(e) =>
                    setTxnModal((m) => ({
                      ...m,
                      day: e.target.value,
                      error: "",
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="Leave blank to default to day 1"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Optional. Use if you want more precision, but month/year is
                  the main tracking.
                </p>
              </Field>
            </div>

            <Field label="Amount (RM)">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                max="999999999"
                value={txnModal.amount}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setTxnModal((m) => ({
                      ...m,
                      amount: e.target.value,
                      error: "",
                    }));
                  }
                }}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 0) {
                    setTxnModal((m) => ({ ...m, amount: num.toFixed(2) }));
                  }
                }}
                className={`mt-1 ${SELECT_UI}`}
                placeholder="200.00"
                required
                aria-required="true"
              />
            </Field>

            <Field label="Notes (optional)">
              <input
                value={txnModal.note}
                onChange={(e) =>
                  setTxnModal((m) => ({ ...m, note: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
                placeholder="e.g., January top-up / ASB dividend 2025"
                maxLength={500}
              />
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <b>Actual history:</b> this record will be saved as{" "}
              <b>completed</b>. Projections are separate and never auto-add to
              balances.
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className={`mt-2 w-full py-2 rounded-lg text-white hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                txnModal.type === "capital_add"
                  ? "bg-gradient-to-r from-blue-500 to-sky-600"
                  : txnModal.type === "dividend"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600"
                    : "bg-gradient-to-r from-rose-500 to-red-600"
              }`}
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : txnModal.type === "capital_add" ? (
                <ArrowUpCircle className="w-4 h-4" />
              ) : txnModal.type === "dividend" ? (
                <Trophy className="w-4 h-4" />
              ) : (
                <MinusCircle className="w-4 h-4" />
              )}
              Save
            </button>
          </form>
        </Modal>
      )}

      {/* Recurring Rule Modal */}
      {ruleModal.open && (
        <Modal
          title={`${ruleModal.mode === "edit" ? "Edit" : "Create"} Recurring Rule • ${ruleModal.accountName}`}
          onClose={() => setRuleModal((m) => ({ ...m, open: false }))}
        >
          {ruleModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {ruleModal.error}
            </div>
          )}

          <form onSubmit={saveRule} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount (RM/month)">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max="999999999"
                  value={ruleModal.amount}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setRuleModal((m) => ({
                        ...m,
                        amount: e.target.value,
                        error: "",
                      }));
                    }
                  }}
                  onBlur={(e) => {
                    const num = parseFloat(e.target.value);
                    if (!isNaN(num) && num > 0) {
                      setRuleModal((m) => ({ ...m, amount: num.toFixed(2) }));
                    }
                  }}
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="100.00"
                  required
                  aria-required="true"
                />
              </Field>
              <Field label="Day of Month (1-28)">
                <input
                  type="number"
                  min="1"
                  max="28"
                  value={ruleModal.dayOfMonth}
                  onChange={(e) =>
                    setRuleModal((m) => ({ ...m, dayOfMonth: e.target.value }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                  placeholder="5"
                  required
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start (Year)">
                <select
                  value={ruleModal.startYear}
                  onChange={(e) =>
                    setRuleModal((m) => ({
                      ...m,
                      startYear: clampInt(e.target.value, 2000, 2100),
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                  required
                >
                  {years
                    .slice()
                    .reverse()
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Start (Month)">
                <select
                  value={ruleModal.startMonth}
                  onChange={(e) =>
                    setRuleModal((m) => ({
                      ...m,
                      startMonth: clampInt(e.target.value, 1, 12),
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                  required
                >
                  {MONTHS.map((mm) => (
                    <option key={mm.value} value={mm.value}>
                      {mm.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-sm text-slate-700 font-medium">
                End month (optional)
              </div>
              <button
                type="button"
                onClick={() =>
                  setRuleModal((m) => ({ ...m, hasEnd: !m.hasEnd }))
                }
                className={`px-3 py-1 rounded-lg text-sm font-medium ${ruleModal.hasEnd ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-700"}`}
                aria-label="Toggle end date"
              >
                {ruleModal.hasEnd ? "Enabled" : "Disabled"}
              </button>
            </div>

            {ruleModal.hasEnd && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="End (Year)">
                  <select
                    value={ruleModal.endYear}
                    onChange={(e) =>
                      setRuleModal((m) => ({
                        ...m,
                        endYear: clampInt(e.target.value, 2000, 2100),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                  >
                    {years
                      .slice()
                      .reverse()
                      .map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                  </select>
                </Field>
                <Field label="End (Month)">
                  <select
                    value={ruleModal.endMonth}
                    onChange={(e) =>
                      setRuleModal((m) => ({
                        ...m,
                        endMonth: clampInt(e.target.value, 1, 12),
                      }))
                    }
                    className={`mt-1 ${SELECT_UI}`}
                  >
                    {MONTHS.map((mm) => (
                      <option key={mm.value} value={mm.value}>
                        {mm.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            )}

            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
              <p className="text-xs text-amber-800 font-semibold">
                Deposit creation mode
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setRuleModal((m) => ({ ...m, modeSetting: "pending" }))
                  }
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    ruleModal.modeSetting === "pending"
                      ? "bg-amber-600 text-white"
                      : "bg-white border border-amber-200 text-amber-800"
                  }`}
                >
                  Pending (recommended)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRuleModal((m) => ({ ...m, modeSetting: "auto_confirm" }))
                  }
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    ruleModal.modeSetting === "auto_confirm"
                      ? "bg-rose-600 text-white"
                      : "bg-white border border-rose-200 text-rose-700"
                  }`}
                >
                  Auto-confirm
                </button>
              </div>
              <p className="text-[11px] text-amber-800 mt-2">
                Auto-confirm creates completed records automatically. This
                assumes you deposited.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <div className="text-sm text-slate-700 font-medium">Active</div>
              <button
                type="button"
                onClick={() =>
                  setRuleModal((m) => ({ ...m, isActive: !m.isActive }))
                }
                className={`px-3 py-1 rounded-lg text-sm font-medium ${ruleModal.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
                aria-label="Toggle rule active status"
              >
                {ruleModal.isActive ? "ON" : "OFF"}
              </button>
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className="mt-2 bg-gradient-to-r from-indigo-500 to-sky-600 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
              Save Rule
            </button>
          </form>
        </Modal>
      )}

      {/* Delete Modal */}
      {deleteModal.open && (
        <Modal
          title="Delete Account"
          onClose={() =>
            setDeleteModal({ open: false, id: null, name: "", error: "" })
          }
        >
          {deleteModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {deleteModal.error}
            </div>
          )}

          <p className="text-sm text-slate-700">
            Are you sure you want to delete <b>{deleteModal.name}</b>? <br />
            This will remove the account and its transactions.
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
              disabled={status.busy}
              className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </button>
          </div>
        </Modal>
      )}

      {/* Export Modal */}
      {exportModal.open && (
        <Modal
          title="Export CSV"
          onClose={() =>
            setExportModal((m) => ({
              ...m,
              open: false,
              error: "",
              busy: false,
            }))
          }
        >
          {exportModal.error && (
            <div
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 mb-3"
              role="alert"
            >
              {exportModal.error}
            </div>
          )}

          <form onSubmit={runExport} className="space-y-3">
            <Field label="Export Type">
              <select
                value={exportModal.exportType}
                onChange={(e) =>
                  setExportModal((m) => ({ ...m, exportType: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
              >
                <option value="transactions">Transactions CSV (default)</option>
                <option value="accounts">Account Summary CSV</option>
                <option value="yearly">Yearly Summary CSV</option>
              </select>
            </Field>

            {exportModal.exportType !== "accounts" && (
              <Field label="Year (optional)">
                <select
                  value={exportModal.year}
                  onChange={(e) =>
                    setExportModal((m) => ({
                      ...m,
                      year: clampInt(e.target.value, 2000, 2100),
                    }))
                  }
                  className={`mt-1 ${SELECT_UI}`}
                >
                  {years
                    .slice()
                    .reverse()
                    .map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                </select>
              </Field>
            )}

            <Field label="Account (optional)">
              <select
                value={exportModal.accountId}
                onChange={(e) =>
                  setExportModal((m) => ({ ...m, accountId: e.target.value }))
                }
                className={`mt-1 ${SELECT_UI}`}
              >
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Export only includes <b>actual</b> data. Pending transactions are
              included and marked. Projections are not exported.
            </div>

            <button
              type="submit"
              disabled={exportModal.busy}
              className="mt-2 bg-gradient-to-r from-slate-900 to-slate-700 text-white w-full py-2 rounded-lg hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {exportModal.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Download CSV
            </button>
          </form>
        </Modal>
      )}
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Reusable UI Bits                              */
/* -------------------------------------------------------------------------- */
const INPUT_UI =
  "w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 placeholder-slate-400 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500";

const SELECT_UI =
  "w-full border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500";

const FILTER_SELECT =
  "px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm " +
  "focus:outline-none focus:ring-2 focus:ring-sky-200 focus:border-sky-500";

const SummaryCard = ({ label, color, value, sub }) => (
  <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-5 sm:p-6 border border-gray-100 shadow-sm hover:shadow-md transition">
    <p className="text-gray-500 text-xs sm:text-sm">{label}</p>
    <h2 className={`text-xl sm:text-2xl font-semibold ${color}`}>{value}</h2>
    {sub && <p className="text-[11px] text-slate-500 mt-1">{sub}</p>}
  </div>
);

const MiniStat = ({ label, value, icon }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
    <div className="p-2 rounded-lg bg-white border border-slate-200">
      {icon}
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-slate-500 truncate">{label}</p>
      <p className="text-xs font-semibold text-slate-800 truncate">{value}</p>
    </div>
  </div>
);

const Segment = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
          value === o.value
            ? "bg-slate-900 text-white"
            : "text-slate-700 hover:bg-slate-50"
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const SavingsCard = ({
  acc,
  rule,
  scopedAgg,
  onEdit,
  onDelete,
  onAddCapital,
  onAddDividend,
  onWithdraw,
  onEditRule,
  busy,
}) => {
  const goal = safeNumber(acc.goal, 0);

  const currentBalance = safeNumber(acc.currentBalance, 0);
  const totalContributed = safeNumber(acc.totalContributed, 0);
  const totalDiv = safeNumber(acc.totalDividendsReceived, 0);
  const totalWithdrawn = safeNumber(acc.totalWithdrawn, 0);

  const roiLifetime =
    totalContributed > 0 ? (totalDiv / totalContributed) * 100 : 0;

  const scopeCap = safeNumber(scopedAgg?.capitalAdded, 0);
  const scopeDiv = safeNumber(scopedAgg?.dividends, 0);
  const scopeW = safeNumber(scopedAgg?.withdrawals, 0);
  const roiScope = scopeCap > 0 ? (scopeDiv / scopeCap) * 100 : 0;

  const rate = safeNumber(acc.ratePercent, 0);
  const freq = acc.returnFrequency || "daily_working";
  const est = estimateReturn(currentBalance, rate, freq, WORKING_DAYS_PER_YEAR);
  const estLabel =
    freq === "daily_working"
      ? "≈ per working day"
      : freq === "daily_calendar"
        ? "≈ per day"
        : freq === "weekly"
          ? "≈ per week"
          : freq === "monthly"
            ? "≈ per month"
            : "≈ per year";

  const progress = goal > 0 ? Math.min((currentBalance / goal) * 100, 100) : 0;

  const ruleText = rule?.isActive
    ? `Auto plan: RM${safeNumber(rule.amount, 0).toFixed(0)} on day ${clampInt(rule.dayOfMonth || 5, 1, 28)}`
    : "Auto plan: OFF";

  return (
    <div className="bg-white/95 backdrop-blur-lg rounded-2xl border border-gray-100 shadow-md p-5 sm:p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="p-2 rounded-lg shrink-0"
            style={{ backgroundColor: `${acc.color || "#0ea5e9"}25` }}
          >
            <PiggyBank
              className="w-5 h-5"
              style={{ color: acc.color || "#0ea5e9" }}
            />
          </div>

          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[#0b1222] truncate">
              {acc.name}
            </h3>
            <p className="text-[11px] text-slate-500 truncate">
              {ruleText} • <span className="font-semibold">Reminder only</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEditRule}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Recurring Rule"
            disabled={busy}
            aria-label="Edit recurring rule"
          >
            <Repeat className="w-4 h-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            title="Edit account"
            disabled={busy}
            aria-label="Edit account"
          >
            <Pencil className="w-4 h-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition"
            title="Delete account"
            disabled={busy}
            aria-label="Delete account"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      </div>

      {/* Key values */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">Current Balance</p>
          <p className="text-sm font-semibold text-slate-900">
            {formatRM(currentBalance)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Used for allocation / net worth
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">
            Total Contributed (lifetime)
          </p>
          <p className="text-sm font-semibold text-slate-900">
            {formatRM(totalContributed)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">ROI denominator</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">
            Total Dividends/Interest (lifetime)
          </p>
          <p className="text-sm font-semibold text-emerald-700">
            {formatRM(totalDiv)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Actual received</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-[11px] text-slate-500">
            Total Withdrawn (lifetime)
          </p>
          <p className="text-sm font-semibold text-rose-700">
            {formatRM(totalWithdrawn)}
          </p>
          <p className="text-[10px] text-slate-500 mt-1">Outflows tracked</p>
        </div>
      </div>

      {/* ROI + Estimated return */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">ROI (actual, lifetime)</p>
          <p className="text-sm font-semibold text-violet-700">
            {roiLifetime.toFixed(2)}%
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Dividends ÷ Contributed
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-[11px] text-slate-500">
            Estimated return (projection)
          </p>
          <p className="text-sm font-semibold text-sky-700">
            {formatRM(est)}{" "}
            <span className="text-[11px] text-slate-500 font-medium">
              {estLabel}
            </span>
          </p>
          <p className="text-[10px] text-slate-500 mt-1">
            Uses expected rate only
          </p>
        </div>
      </div>

      {/* Goal progress */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span className="font-semibold">Goal progress</span>
          <span>{goal > 0 ? `${progress.toFixed(1)}%` : "No goal"}</span>
        </div>
        <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${acc.color || "#0ea5e9"}, #22c55e)`,
            }}
          />
        </div>
        {goal > 0 && (
          <p className="mt-2 text-[11px] text-slate-500">
            {formatRM(currentBalance)} / {formatRM(goal)}
          </p>
        )}
      </div>

      {/* Scoped view */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700 flex items-center gap-2">
          <Calendar className="w-4 h-4" /> Selected period (actual)
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-slate-500">Capital add</p>
            <p className="font-semibold text-slate-900">{formatRM(scopeCap)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-slate-500">Dividend</p>
            <p className="font-semibold text-emerald-700">
              {formatRM(scopeDiv)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <p className="text-slate-500">Withdraw</p>
            <p className="font-semibold text-rose-700">{formatRM(scopeW)}</p>
          </div>
        </div>

        <div className="mt-2 text-[11px] text-slate-600">
          ROI (selected):{" "}
          <span className="font-semibold text-violet-700">
            {roiScope.toFixed(2)}%
          </span>
          <span className="text-slate-400"> • </span>
          <span className="text-slate-500">Completed transactions only</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAddCapital}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-sky-600 text-white text-sm font-semibold hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add capital"
        >
          <ArrowUpCircle className="w-4 h-4" /> + Capital
        </button>

        <button
          type="button"
          onClick={onAddDividend}
          disabled={busy}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-sm font-semibold hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Add dividend"
        >
          <Trophy className="w-4 h-4" /> + Dividend
        </button>

        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          className="col-span-2 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-sm font-semibold hover:opacity-95 transition disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Withdraw"
        >
          <MinusCircle className="w-4 h-4" /> Withdraw
        </button>
      </div>

      <div className="mt-3 text-[11px] text-slate-500">
        Projection fields never change actual balances. Record real
        deposits/withdrawals as transactions.
      </div>
    </div>
  );
};

/* ------------------------------ small primitives ------------------------------ */

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    {children}
  </label>
);

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center">
    <div
      className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
      onClick={onClose}
      role="button"
      tabIndex={0}
      aria-label="Close modal"
    />
    <div className="relative w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 max-h-[88vh] overflow-y-auto">
      <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-5 py-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-[#0b1222] truncate">
            {title}
          </h3>
          <p className="text-[11px] text-slate-500 mt-1">
            Month/year tracking • Net worth ready • No bank integration
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
          aria-label="Close modal"
        >
          <X className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);
