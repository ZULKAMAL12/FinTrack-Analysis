import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Plus,
  PiggyBank,
  RefreshCw,
  Pencil,
  X,
  Loader2,
  CloudOff,
  Trash2,
  Download,
  Calendar,
  Repeat,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flame,
  Target,
  Trophy,
  Wallet,
  Coins,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/*                                    API                                     */
/* -------------------------------------------------------------------------- */
const API = {
  ACCOUNTS: "/api/savings/accounts",
  TX: "/api/savings/transactions",
  TX_BY_ID: (id) => `/api/savings/transactions/${id}`,
  TX_BULK_CONFIRM: "/api/savings/transactions/bulk-confirm",
  RULES: "/api/savings/recurring-rules",
  RULE_BY_ID: (id) => `/api/savings/recurring-rules/${id}`,
  RULE_GENERATE_MISSING: "/api/savings/recurring-rules/generate-missing",
  ALERTS: "/api/savings/alerts",
  STATS_DEPOSITS: "/api/savings/stats/deposits",
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
    signal: options.signal,
  });

  if (res.status === 401) {
    localStorage.removeItem("token");
    window.location.href = "/login";
    throw new Error("Session expired. Please login again.");
  }

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

function isValidDay(year, month, day) {
  if (!day) return true;
  const maxDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDay;
}

function isValidDecimal(value) {
  if (!value) return true;
  return /^\d*\.?\d{0,2}$/.test(value);
}

function txTypeLabel(t) {
  if (t === "capital_add") return "Deposit";
  if (t === "dividend") return "Interest/Dividend";
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
    return { text: "Auto", cls: "bg-indigo-100 text-indigo-700" };
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
  const [alerts, setAlerts] = useState([]);
  const [depositStats, setDepositStats] = useState(null);

  const [toast, setToast] = useState({ show: false, msg: "", tone: "info" });

  const showToast = useCallback((msg, tone = "info") => {
    setToast({ show: true, msg, tone });
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToast({ show: false, msg: "", tone: "info" });
    }, 2600);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  /* ------------------------------ Modals ------------------------------ */
  const [addModal, setAddModal] = useState({
    open: false,
    name: "",
    color: "#0ea5e9",
    goal: "",
    startingBalance: "",
    autoDepositReminder: false,
    recurringAmount: "",
    recurringDay: "5",
    error: "",
  });

  const [editModal, setEditModal] = useState({
    open: false,
    id: null,
    name: "",
    color: "#0ea5e9",
    goal: "",
    startingBalance: "",
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
          if (e.name !== "AbortError") console.error("Failed to load rules:", e);
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

  async function loadAlerts(signal) {
    try {
      const data = await apiFetch(API.ALERTS, { signal });
      setAlerts(data.alerts || []);
    } catch (e) {
      if (e.name !== "AbortError") console.error("Failed to load alerts:", e);
    }
  }

  async function loadDepositStats(signal) {
    try {
      const data = await apiFetch(API.STATS_DEPOSITS, { signal });
      setDepositStats(data);
    } catch (e) {
      if (e.name !== "AbortError") console.error("Failed to load deposit stats:", e);
    }
  }

  async function generateMissingRecurringIfAny(signal) {
    try {
      await apiFetch(API.RULE_GENERATE_MISSING, { method: "POST", signal });
    } catch (e) {
      if (e.name !== "AbortError") console.error("Failed to generate recurring:", e);
    }
  }

  async function loadAll() {
    if (abortControllerRef.current) abortControllerRef.current.abort();

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setStatus((s) => ({ ...s, loading: true, error: "" }));

    try {
      await generateMissingRecurringIfAny(abortController.signal);
      await Promise.all([
        loadAccountsAndRules(abortController.signal),
        loadTransactionsForFilter(filter, abortController.signal),
        loadAlerts(abortController.signal),
        loadDepositStats(abortController.signal),
      ]);
      didHydrateRef.current = true;
      setStatus((s) => ({ ...s, loading: false }));
    } catch (e) {
      if (e.name === "AbortError") return;
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

  useEffect(() => {
    if (!didHydrateRef.current) return;

    const abortController = new AbortController();

    (async () => {
      try {
        setStatus((s) => ({ ...s, loading: true, error: "" }));
        await Promise.all([
          loadTransactionsForFilter(filter, abortController.signal),
          loadAlerts(abortController.signal),
          loadDepositStats(abortController.signal),
        ]);
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

    return () => abortController.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.year, filter.month, filter.accountId, filter.viewMode]);

  /* -------------------------------------------------------------------------- */
  /*                               Derived Metrics                              */
  /* -------------------------------------------------------------------------- */

  const totals = useMemo(() => {
    let totalBalance = 0;
    let totalSaved = 0;
    let accountsWithGoals = 0;
    let accountsNearGoal = 0;

    for (const a of accounts) {
      const balance = safeNumber(a.currentBalance);
      const goal = safeNumber(a.goal);

      totalBalance += balance;
      totalSaved += safeNumber(a.totalContributed);

      if (goal > 0) {
        accountsWithGoals++;
        const progress = (balance / goal) * 100;
        if (progress >= 80) accountsNearGoal++;
      }
    }

    return {
      totalBalance,
      totalSaved,
      accountsCount: accounts.length,
      accountsWithGoals,
      accountsNearGoal,
    };
  }, [accounts]);

  /* -------------------------------------------------------------------------- */
  /*                                CRUD Actions                                */
  /* -------------------------------------------------------------------------- */

  function openAddAccount() {
    setAddModal({
      open: true,
      name: "",
      color: "#0ea5e9",
      goal: "",
      startingBalance: "",
      autoDepositReminder: false,
      recurringAmount: "",
      recurringDay: "5",
      error: "",
    });
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
      ratePercent: 0,
      returnFrequency: "monthly",
      monthlyContribution: 0,
      autoDepositReminder: !!addModal.autoDepositReminder,
    };

    setStatus((s) => ({ ...s, busy: true, error: "" }));

    try {
      const res = await apiFetch(API.ACCOUNTS, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const created = res.account;

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
          startYear: nowYM.year,
          startMonth: nowYM.month,
          mode: "pending",
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
      showToast("Account created successfully", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, busy: false }));
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
      startingBalance: String(safeNumber(acc.startingBalance)),
      error: "",
    });
  }

  async function saveEditAccount(e) {
    e.preventDefault();

    const name = String(editModal.name || "").trim();
    if (!name) {
      return setEditModal((m) => ({ ...m, error: "Account name is required." }));
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
      ratePercent: 0,
      returnFrequency: "monthly",
      monthlyContribution: 0,
      autoDepositReminder: false,
    };

    setStatus((s) => ({ ...s, busy: true, error: "" }));

    try {
      await apiFetch(`${API.ACCOUNTS}/${editModal.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setEditModal((m) => ({ ...m, open: false }));
      showToast("Account updated successfully", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e2) {
      setStatus((s) => ({ ...s, busy: false }));
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
    setStatus((s) => ({ ...s, busy: true, error: "" }));
    try {
      await apiFetch(`${API.ACCOUNTS}/${deleteModal.id}`, { method: "DELETE" });
      setDeleteModal({ open: false, id: null, name: "", error: "" });
      showToast("Account deleted successfully", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false }));
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
      return setTxnModal((m) => ({ ...m, error: "Enter a valid amount (> 0)." }));
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
      notes: String(txnModal.note || "").trim().substring(0, 500),
    };

    setStatus((s) => ({ ...s, busy: true, error: "" }));

    try {
      await apiFetch(API.TX, { method: "POST", body: JSON.stringify(payload) });
      setTxnModal((m) => ({ ...m, open: false }));
      showToast("Transaction saved successfully", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false }));
      setTxnModal((m) => ({
        ...m,
        error: err?.message || "Failed to save transaction.",
      }));
    }
  }

  async function confirmPendingTx(txn) {
    setStatus((s) => ({ ...s, busy: true, error: "" }));
    try {
      await apiFetch(API.TX_BY_ID(txn._id), {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      showToast("Transaction confirmed", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false }));
      showToast(e?.message || "Failed to confirm", "warn");
    }
  }

  async function bulkConfirmPending(transactionIds) {
    setStatus((s) => ({ ...s, busy: true, error: "" }));
    try {
      await apiFetch(API.TX_BULK_CONFIRM, {
        method: "PATCH",
        body: JSON.stringify({ transactionIds }),
      });
      showToast("All transactions confirmed!", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (e) {
      setStatus((s) => ({ ...s, busy: false }));
      showToast(e?.message || "Failed to bulk confirm", "warn");
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
      startYear: nowYM.year,
      startMonth: nowYM.month,
      mode: "pending",
      isActive: !!ruleModal.isActive,
    };

    setStatus((s) => ({ ...s, busy: true, error: "" }));
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
      showToast("Reminder saved successfully", "ok");
      await loadAll();
      setStatus((s) => ({ ...s, busy: false }));
    } catch (err) {
      setStatus((s) => ({ ...s, busy: false }));
      setRuleModal((m) => ({
        ...m,
        error: err?.message || "Failed to save reminder.",
      }));
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                                   Export                                   */
  /* -------------------------------------------------------------------------- */

  function openExport() {
    setExportModal({
      open: true,
      exportType: "transactions",
      year: filter.year,
      accountId: filter.accountId,
      error: "",
      busy: false,
    });
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
      showToast("Export started successfully", "ok");
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
    <main className="min-h-screen bg-gradient-to-br from-[#f9fbff] via-[#edf4ff] to-[#e5edff] px-4 sm:px-6 md:px-10 lg:px-12 py-8 font-inter">
      {/* Header */}
      <header className="mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#0b1222]">
              Savings Tracker
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-1">
              Simple savings tracking with smart reminders
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => loadAll()}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition disabled:opacity-50"
              type="button"
              disabled={status.busy || status.loading}
            >
              <RefreshCw
                className={`w-4 h-4 ${status.loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              onClick={openExport}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 transition"
              type="button"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={openAddAccount}
              className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.02] transition"
              type="button"
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
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                  className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
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
                className="px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-900 text-xs font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 min-w-[180px]"
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
              </span>
            </div>
          </div>
        </div>
      </header>

      {status.error && (
        <div
          className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm text-rose-700 flex items-center gap-2"
          role="alert"
        >
          <CloudOff className="w-4 h-4" />
          {status.error}
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]"
          role="alert"
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

      {/* Smart Alerts */}
      {alerts.length > 0 && (
        <section className="mb-8">
          <SmartAlertsWidget alerts={alerts} />
        </section>
      )}

      {/* Month Comparison */}
      {depositStats && (
        <section className="mb-8">
          <MonthComparisonWidget stats={depositStats} />
        </section>
      )}

      {/* Quick Stats Dashboard */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
        <QuickStatCard
          icon={<Wallet className="w-5 h-5 text-sky-600" />}
          label="Total Balance"
          value={formatRM(totals.totalBalance)}
          subtitle="Current net worth"
        />
        <QuickStatCard
          icon={<Coins className="w-5 h-5 text-emerald-600" />}
          label="Total Saved"
          value={formatRM(totals.totalSaved)}
          subtitle="Lifetime contributions"
        />
        <QuickStatCard
          icon={<PiggyBank className="w-5 h-5 text-indigo-600" />}
          label="Accounts"
          value={totals.accountsCount}
          subtitle={`${totals.accountsWithGoals} with goals`}
        />
        <QuickStatCard
          icon={<Trophy className="w-5 h-5 text-amber-600" />}
          label="Near Goal"
          value={totals.accountsNearGoal}
          subtitle="80%+ progress"
        />
      </section>

      {/* Pending Deposits */}
      <section className="mb-8">
        <PendingDepositsWidget
          pendingTx={pendingTx}
          accounts={accounts}
          filter={filter}
          nowYM={nowYM}
          loading={status.loading}
          busy={status.busy}
          onConfirmSingle={confirmPendingTx}
          onBulkConfirm={bulkConfirmPending}
        />
      </section>

      {/* Accounts */}
      {status.loading ? (
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading savings accounts...
        </div>
      ) : (
        <section className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-8">
          {accounts.map((acc) => (
            <SavingsCard
              key={acc._id}
              acc={acc}
              busy={status.busy}
              rule={rulesByAccount[acc._id]}
              onEdit={() => openEditAccount(acc)}
              onDelete={() => openDelete(acc)}
              onAddDeposit={() => openTxn(acc, "capital_add")}
              onAddInterest={() => openTxn(acc, "dividend")}
              onWithdraw={() => openTxn(acc, "withdrawal")}
              onEditRule={() => openRuleEditor(acc)}
            />
          ))}

          {accounts.length === 0 && (
            <div className="col-span-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
              <PiggyBank className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-700 font-medium mb-2">
                No savings accounts yet
              </p>
              <p className="text-sm text-slate-500 mb-4">
                Get started by creating your first savings account
              </p>
              <button
                onClick={openAddAccount}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-sky-600 text-white px-5 py-2 rounded-xl shadow hover:scale-[1.02] transition"
              >
                <Plus className="w-4 h-4" /> Add Your First Account
              </button>
            </div>
          )}
        </section>
      )}

      {/* Transaction History */}
      <section>
        <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-semibold text-[#0b1222]">
                Transaction History
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                All your deposits, interest, and withdrawals
              </p>
            </div>

            <div className="text-xs text-slate-500">
              {filter.viewMode === "month"
                ? yyyymmToLabel(filter.year, filter.month || nowYM.month)
                : `Year ${filter.year}`}
            </div>
          </div>

          {tx.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 text-sm text-center">
              No transactions found for this period
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-600 border-b">
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Account</th>
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
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="py-2 pr-4 text-slate-700">
                          {yyyymmToLabel(t.year, t.month)}
                          {t.day ? `, ${t.day}` : ""}
                        </td>
                        <td className="py-2 pr-4 font-medium text-slate-800">
                          {t.accountName ||
                            accounts.find((a) => a._id === t.accountId)?.name ||
                            "—"}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">
                          {txTypeLabel(t.type)}
                        </td>
                        <td className="py-2 pr-4 font-semibold text-slate-900">
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
                        <td className="py-2 pr-4 text-slate-600 max-w-xs truncate">
                          {t.notes || "—"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
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

          <form onSubmit={createAccount} className="space-y-4">
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
                className={INPUT_CLASS}
                placeholder="Emergency Fund, Vacation, etc."
                maxLength={100}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <input
                  type="color"
                  value={addModal.color}
                  onChange={(e) =>
                    setAddModal((m) => ({ ...m, color: e.target.value }))
                  }
                  className="w-full border rounded-xl px-3 py-2 h-[42px]"
                />
              </Field>

              <Field label="Goal Amount (RM)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={addModal.goal}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setAddModal((m) => ({ ...m, goal: e.target.value }));
                    }
                  }}
                  className={INPUT_CLASS}
                  placeholder="5000"
                />
              </Field>
            </div>

            <Field label="Current Balance (RM)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={addModal.startingBalance}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setAddModal((m) => ({
                      ...m,
                      startingBalance: e.target.value,
                    }));
                  }
                }}
                className={INPUT_CLASS}
                placeholder="1000"
              />
            </Field>

            {/* Auto Reminder */}
            <div className="rounded-xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Repeat className="w-4 h-4 text-slate-700" />
                  <span className="text-sm font-semibold text-slate-700">
                    Monthly Deposit Reminder
                  </span>
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
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {addModal.autoDepositReminder ? "ON" : "OFF"}
                </button>
              </div>

              {addModal.autoDepositReminder && (
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <Field label="Amount (RM/month)">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={addModal.recurringAmount}
                      onChange={(e) => {
                        if (isValidDecimal(e.target.value)) {
                          setAddModal((m) => ({
                            ...m,
                            recurringAmount: e.target.value,
                          }));
                        }
                      }}
                      className={INPUT_CLASS}
                      placeholder="100"
                    />
                  </Field>

                  <Field label="Day of Month">
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
                      className={INPUT_CLASS}
                      placeholder="5"
                    />
                  </Field>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className="w-full bg-gradient-to-r from-blue-500 to-sky-600 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
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

          <form onSubmit={saveEditAccount} className="space-y-4">
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
                className={INPUT_CLASS}
                maxLength={100}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Color">
                <input
                  type="color"
                  value={editModal.color}
                  onChange={(e) =>
                    setEditModal((m) => ({ ...m, color: e.target.value }))
                  }
                  className="w-full border rounded-xl px-3 py-2 h-[42px]"
                />
              </Field>

              <Field label="Goal Amount (RM)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editModal.goal}
                  onChange={(e) => {
                    if (isValidDecimal(e.target.value)) {
                      setEditModal((m) => ({ ...m, goal: e.target.value }));
                    }
                  }}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            <Field label="Current Balance (RM)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={editModal.startingBalance}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setEditModal((m) => ({
                      ...m,
                      startingBalance: e.target.value,
                    }));
                  }
                }}
                className={INPUT_CLASS}
              />
            </Field>

            <button
              type="submit"
              disabled={status.busy}
              className="w-full bg-gradient-to-r from-blue-500 to-sky-600 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Transaction Modal */}
      {txnModal.open && (
        <Modal
          title={`${txTypeLabel(txnModal.type)} • ${txnModal.accountName}`}
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

          <form onSubmit={saveTxn} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Year">
                <select
                  value={txnModal.year}
                  onChange={(e) =>
                    setTxnModal((m) => ({
                      ...m,
                      year: clampInt(e.target.value, 2000, 2100),
                    }))
                  }
                  className={INPUT_CLASS}
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
                  className={INPUT_CLASS}
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

            <Field label="Amount (RM)">
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={txnModal.amount}
                onChange={(e) => {
                  if (isValidDecimal(e.target.value)) {
                    setTxnModal((m) => ({
                      ...m,
                      amount: e.target.value,
                      error: "",
                    }))
                  }
                }}
                className={INPUT_CLASS}
                placeholder="200.00"
                required
              />
            </Field>

            <Field label="Notes (optional)">
              <input
                value={txnModal.note}
                onChange={(e) =>
                  setTxnModal((m) => ({ ...m, note: e.target.value }))
                }
                className={INPUT_CLASS}
                placeholder="e.g., Monthly savings"
                maxLength={500}
              />
            </Field>

            <button
              type="submit"
              disabled={status.busy}
              className={`w-full py-2.5 rounded-xl font-semibold text-white hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50 ${
                txnModal.type === "capital_add"
                  ? "bg-gradient-to-r from-blue-500 to-sky-600"
                  : txnModal.type === "dividend"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-600"
                    : "bg-gradient-to-r from-rose-500 to-red-600"
              }`}
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save Transaction
            </button>
          </form>
        </Modal>
      )}

      {/* Recurring Rule Modal */}
      {ruleModal.open && (
        <Modal
          title={`${ruleModal.mode === "edit" ? "Edit" : "Create"} Reminder • ${ruleModal.accountName}`}
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

          <form onSubmit={saveRule} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (RM/month)">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
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
                  className={INPUT_CLASS}
                  placeholder="100.00"
                  required
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
                  className={INPUT_CLASS}
                  placeholder="5"
                  required
                />
              </Field>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-slate-50 px-4 py-3">
              <span className="text-sm font-medium text-slate-700">Active</span>
              <button
                type="button"
                onClick={() =>
                  setRuleModal((m) => ({ ...m, isActive: !m.isActive }))
                }
                className={`px-3 py-1 rounded-lg text-sm font-medium ${ruleModal.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}
              >
                {ruleModal.isActive ? "ON" : "OFF"}
              </button>
            </div>

            <button
              type="submit"
              disabled={status.busy}
              className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {status.busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
              Save Reminder
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

          <p className="text-sm text-slate-700 mb-6">
            Are you sure you want to delete <b>{deleteModal.name}</b>?
            <br />
            This will permanently remove the account and all its transactions.
          </p>

          <div className="flex items-center justify-end gap-2">
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
              className="px-4 py-2 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition flex items-center gap-2 disabled:opacity-50"
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
          title="Export Data"
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

          <form onSubmit={runExport} className="space-y-4">
            <Field label="Export Type">
              <select
                value={exportModal.exportType}
                onChange={(e) =>
                  setExportModal((m) => ({ ...m, exportType: e.target.value }))
                }
                className={INPUT_CLASS}
              >
                <option value="transactions">Transactions</option>
                <option value="accounts">Account Summary</option>
                <option value="yearly">Yearly Summary</option>
              </select>
            </Field>

            {exportModal.exportType !== "accounts" && (
              <Field label="Year">
                <select
                  value={exportModal.year}
                  onChange={(e) =>
                    setExportModal((m) => ({
                      ...m,
                      year: clampInt(e.target.value, 2000, 2100),
                    }))
                  }
                  className={INPUT_CLASS}
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

            <Field label="Account">
              <select
                value={exportModal.accountId}
                onChange={(e) =>
                  setExportModal((m) => ({ ...m, accountId: e.target.value }))
                }
                className={INPUT_CLASS}
              >
                <option value="all">All accounts</option>
                {accounts.map((a) => (
                  <option key={a._id} value={a._id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>

            <button
              type="submit"
              disabled={exportModal.busy}
              className="w-full bg-gradient-to-r from-slate-900 to-slate-700 text-white py-2.5 rounded-xl font-semibold hover:opacity-90 transition flex items-center justify-center gap-2 disabled:opacity-50"
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
/*                             WIDGET COMPONENTS                              */
/* -------------------------------------------------------------------------- */

const QuickStatCard = ({ icon, label, value, subtitle }) => (
  <div className="bg-white/90 backdrop-blur-lg rounded-2xl p-5 border border-slate-100 shadow-sm hover:shadow-md transition">
    <div className="flex items-start justify-between mb-2">
      <div className="p-2 bg-sky-50 rounded-xl">{icon}</div>
    </div>
    <p className="text-xs text-slate-500">{label}</p>
    <h3 className="text-2xl font-bold text-slate-900 mt-1">{value}</h3>
    {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
  </div>
);

const SmartAlertsWidget = ({ alerts }) => {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-2xl p-5 sm:p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-100 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">Smart Alerts</h3>
          <p className="text-sm text-slate-600">Important insights</p>
        </div>
      </div>

      <div className="space-y-3">
        {alerts.map((alert, idx) => (
          <div
            key={idx}
            className={`rounded-xl border-2 p-4 ${
              alert.severity === "high"
                ? "bg-rose-50 border-rose-300"
                : alert.severity === "medium"
                  ? "bg-amber-50 border-amber-300"
                  : "bg-emerald-50 border-emerald-300"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                {alert.severity === "high" ? (
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                ) : alert.severity === "medium" ? (
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                ) : (
                  <Flame className="w-5 h-5 text-emerald-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {alert.title}
                </p>
                <p className="text-xs text-slate-600 mt-1">{alert.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MonthComparisonWidget = ({ stats }) => {
  if (!stats) return null;

  const { currentMonth, lastMonth, changes, streak, consistency } = stats;

  return (
    <div className="bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-200 rounded-2xl p-5 sm:p-6 shadow-md">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-sky-100 rounded-lg">
          <TrendingUp className="w-5 h-5 text-sky-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-slate-900">
            This Month vs Last Month
          </h3>
          <p className="text-sm text-slate-600">Performance comparison</p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-sky-100">
          <p className="text-xs text-slate-600 mb-2">Deposits</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-slate-900">
              {formatRM(currentMonth.capital)}
            </p>
            {changes.capitalTrend !== "same" && (
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${
                  changes.capitalTrend === "up"
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {changes.capitalTrend === "up" ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(changes.capitalChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Last: {formatRM(lastMonth.capital)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-sky-100">
          <p className="text-xs text-slate-600 mb-2">Interest</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-emerald-700">
              {formatRM(currentMonth.dividends)}
            </p>
            {changes.dividendsTrend !== "same" && (
              <div
                className={`flex items-center gap-1 text-xs font-semibold ${
                  changes.dividendsTrend === "up"
                    ? "text-emerald-600"
                    : "text-rose-600"
                }`}
              >
                {changes.dividendsTrend === "up" ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(changes.dividendsChange).toFixed(1)}%
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Last: {formatRM(lastMonth.dividends)}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-sky-100">
          <p className="text-xs text-slate-600 mb-2">Streak</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-indigo-700">
              {streak.current}
            </p>
            <p className="text-xs text-slate-500">months</p>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Record: {streak.longest}
          </p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-sky-100">
          <p className="text-xs text-slate-600 mb-2">Consistency</p>
          <div className="flex items-baseline gap-2">
            <p className="text-xl font-bold text-violet-700">
              {consistency.score}%
            </p>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {consistency.monthsWithDeposits}/6 months
          </p>
        </div>
      </div>
    </div>
  );
};

const PendingDepositsWidget = ({
  pendingTx,
  accounts,
  filter,
  nowYM,
  loading,
  busy,
  onConfirmSingle,
  onBulkConfirm,
}) => {
  const [selectedIds, setSelectedIds] = useState([]);

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    if (selectedIds.length === pendingTx.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingTx.map((t) => t._id));
    }
  };

  const handleBulkConfirm = () => {
    if (selectedIds.length === 0) return;
    onBulkConfirm(selectedIds);
    setSelectedIds([]);
  };

  if (loading) {
    return (
      <div className="bg-white/85 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-center gap-2 text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading pending deposits...
        </div>
      </div>
    );
  }

  if (pendingTx.length === 0) return null;

  return (
    <div className="bg-white/85 backdrop-blur-lg rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-[#0b1222] flex items-center gap-2">
            <Repeat className="w-5 h-5 text-indigo-600" /> Pending Deposits
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Confirm deposits you've actually made
          </p>
        </div>
        <div className="text-xs text-slate-500">
          {filter.viewMode === "month"
            ? yyyymmToLabel(filter.year, filter.month || nowYM.month)
            : `Year ${filter.year}`}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-emerald-800">
            {selectedIds.length} selected
          </p>
          <button
            onClick={handleBulkConfirm}
            disabled={busy}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-600 text-white rounded-lg text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
            type="button"
          >
            <CheckCircle2 className="w-4 h-4" />
            Confirm All
          </button>
        </div>
      )}

      <div className="mb-3">
        <button
          onClick={selectAll}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold"
          type="button"
        >
          {selectedIds.length === pendingTx.length
            ? "Deselect All"
            : "Select All"}
        </button>
      </div>

      <div className="space-y-2">
        {pendingTx.slice(0, 12).map((t) => (
          <div
            key={t._id}
            className="rounded-xl border border-slate-200 bg-white p-3 flex items-center gap-3"
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(t._id)}
              onChange={() => toggleSelect(t._id)}
              className="w-4 h-4 rounded border-slate-300 text-indigo-600"
            />

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">
                {t.accountName ||
                  accounts.find((a) => a._id === t.accountId)?.name ||
                  "Account"}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {yyyymmToLabel(t.year, t.month)} • {formatRM(t.amount)}
              </p>
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => onConfirmSingle(t)}
              className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Confirm
            </button>
          </div>
        ))}

        {pendingTx.length > 12 && (
          <p className="text-xs text-slate-500 mt-2">
            Showing first 12. Use filters to narrow down.
          </p>
        )}
      </div>
    </div>
  );
};

const SavingsCard = ({
  acc,
  rule,
  busy,
  onEdit,
  onDelete,
  onAddDeposit,
  onAddInterest,
  onWithdraw,
  onEditRule,
}) => {
  const balance = safeNumber(acc.currentBalance);
  const goal = safeNumber(acc.goal);
  const progress = goal > 0 ? Math.min((balance / goal) * 100, 100) : 0;

  const ruleText = rule?.isActive
    ? `RM${safeNumber(rule.amount, 0).toFixed(0)} on day ${clampInt(rule.dayOfMonth || 5, 1, 28)}`
    : "No reminder set";

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-2xl border border-slate-100 shadow-md p-5 sm:p-6 hover:shadow-lg transition">
      {/* Header */}
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
            <p className="text-xs text-slate-500 truncate">{ruleText}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onEditRule}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            disabled={busy}
          >
            <Repeat className="w-4 h-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition"
            disabled={busy}
          >
            <Pencil className="w-4 h-4 text-slate-700" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition"
            disabled={busy}
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
          </button>
        </div>
      </div>

      {/* Balance */}
      <div className="mb-4">
        <p className="text-xs text-slate-500">Current Balance</p>
        <p className="text-3xl font-bold text-slate-900">{formatRM(balance)}</p>
      </div>

      {/* Goal Progress */}
      {goal > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
            <span>Goal: {formatRM(goal)}</span>
            <span>{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: `linear-gradient(90deg, ${acc.color || "#0ea5e9"}, #22c55e)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onAddDeposit}
          disabled={busy}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-sky-600 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Deposit
        </button>

        <button
          type="button"
          onClick={onAddInterest}
          disabled={busy}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <Trophy className="w-4 h-4" />
          Interest
        </button>

        <button
          type="button"
          onClick={onWithdraw}
          disabled={busy}
          className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 text-white text-xs font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          <Target className="w-4 h-4" />
          Withdraw
        </button>
      </div>
    </div>
  );
};

const Segment = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
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

const Field = ({ label, children }) => (
  <div>
    <label className="block text-sm font-semibold text-slate-700 mb-1">
      {label}
    </label>
    {children}
  </div>
);

const Modal = ({ title, onClose, children }) => {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-bold text-[#0b1222]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5 text-slate-700" />
          </button>
        </div>

        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/*                              Tailwind Classes                              */
/* -------------------------------------------------------------------------- */

const INPUT_CLASS =
  "w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 transition";