import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import illustration from "../assets/finance-illustration.svg";

/**
 * Password rules:
 * - min 8 chars
 * - at least 1 number
 * - at least 1 special character
 */
const PASSWORD_RULES = {
  minLen: 8,
  hasNumber: /\d/,
  hasSpecial: /[^A-Za-z0-9]/,
};

function validatePassword(pw) {
  const issues = [];
  if (!pw || pw.length < PASSWORD_RULES.minLen)
    issues.push("At least 8 characters");
  if (!PASSWORD_RULES.hasNumber.test(pw)) issues.push("At least 1 number");
  if (!PASSWORD_RULES.hasSpecial.test(pw))
    issues.push("At least 1 special character");
  return issues;
}

async function apiRegister({ name, email, password }) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error("Missing VITE_API_URL in frontend .env");

  const res = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) throw new Error(data.message || "Registration failed");
  return data; // { token, user }
}

export default function Register() {
  const nav = useNavigate();

  // form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ui state
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });

  const passwordIssues = useMemo(() => validatePassword(password), [password]);
  const passwordsMatch =
    password && confirmPassword && password === confirmPassword;

  const canSubmit =
    !status.loading &&
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    passwordIssues.length === 0 &&
    password === confirmPassword;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: "", success: "" });

    const name = fullName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Client-side validation (backend should still validate too)
    if (name.length < 2) {
      setStatus({
        loading: false,
        error: "Name must be at least 2 characters.",
        success: "",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus({
        loading: false,
        error: "Please enter a valid email.",
        success: "",
      });
      return;
    }
    const issues = validatePassword(password);
    if (issues.length) {
      setStatus({
        loading: false,
        error: `Password requirements: ${issues.join(", ")}.`,
        success: "",
      });
      return;
    }
    if (password !== confirmPassword) {
      setStatus({
        loading: false,
        error: "Passwords do not match.",
        success: "",
      });
      return;
    }

    try {
      const data = await apiRegister({
        name,
        email: normalizedEmail,
        password,
      });

      // Store token for later (login session). You can switch to cookies later if you want.
      if (data?.token) localStorage.setItem("token", data.token);

      setStatus({
        loading: false,
        error: "",
        success: "Account created! Redirecting...",
      });

      // Go to login page (or dashboard if you already have protected route)
      setTimeout(() => nav("/login"), 600);
    } catch (err) {
      setStatus({
        loading: false,
        error: err?.message || "Registration failed.",
        success: "",
      });
    }
  }

  return (
    <main className="register-page relative flex items-center justify-center min-h-[calc(100vh-5rem)] overflow-hidden bg-gradient-to-br from-[#eef4ff] via-[#e4ecff] to-[#dae6ff]">
      {/* Soft glowing background shapes */}
      <div className="register-page__glow register-page__glow--top absolute w-[500px] h-[500px] bg-sky-300/20 rounded-full blur-3xl top-[-150px] left-[-150px]" />
      <div className="register-page__glow register-page__glow--bottom absolute w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-2xl bottom-[-100px] right-[-100px]" />

      <div className="register-card relative z-10 flex flex-col md:flex-row items-center justify-center bg-white/60 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 p-10 md:p-12 gap-12 max-w-5xl w-[95%]">
        {/* Illustration + Intro */}
        <section className="register-card__intro flex flex-col items-center md:items-start text-center md:text-left md:w-1/2 space-y-6">
          <img
            src={illustration}
            alt="Finance Illustration"
            className="register-card__illustration w-64 md:w-72 drop-shadow-md"
          />
          <h2 className="register-card__title text-2xl md:text-3xl font-bold text-[#0b1222]">
            Join <span className="text-sky-500">FinTrack</span> Today
          </h2>
          <p className="register-card__subtitle text-gray-600 text-sm md:text-base leading-relaxed max-w-sm">
            Start tracking your savings, expenses, and investments effortlessly
            — your financial future starts here.
          </p>
        </section>

        {/* Register Form */}
        <section className="register-form w-full md:w-1/2 max-w-sm bg-white/70 rounded-2xl border border-gray-100 shadow-lg p-8">
          <header className="register-form__header">
            <h1 className="register-form__heading text-2xl font-bold text-center mb-2 bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
              Create Account
            </h1>
            <p className="register-form__desc text-center text-gray-500 mb-6">
              Get started with your free FinTrack account
            </p>
          </header>

          {(status.error || status.success) && (
            <div
              className={`register-form__alert mb-5 rounded-xl px-4 py-3 text-sm border ${
                status.error
                  ? "bg-red-50 text-red-700 border-red-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
              }`}
              role="status"
              aria-live="polite"
            >
              {status.error || status.success}
            </div>
          )}

          <form
            className="register-form__body space-y-5"
            onSubmit={handleSubmit}
          >
            <div className="form-field">
              <label className="form-field__label block text-sm mb-2 text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your Name"
                className="form-field__input w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 outline-none transition"
                autoComplete="name"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-field__label block text-sm mb-2 text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="form-field__input w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 outline-none transition"
                autoComplete="email"
                required
              />
            </div>

            <div className="form-field">
              <label className="form-field__label block text-sm mb-2 text-gray-700">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-field__input w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 outline-none transition"
                autoComplete="new-password"
                required
              />

              <div className="form-field__hint mt-2 text-xs text-gray-500">
                Must include: <span className="font-medium">8+ chars</span>,{" "}
                <span className="font-medium">1 number</span>,{" "}
                <span className="font-medium">1 special</span>.
              </div>

              {password.length > 0 && (
                <ul className="form-field__rules mt-2 text-xs space-y-1">
                  <li
                    className={
                      password.length >= 8
                        ? "text-emerald-600"
                        : "text-gray-500"
                    }
                  >
                    • At least 8 characters
                  </li>
                  <li
                    className={
                      PASSWORD_RULES.hasNumber.test(password)
                        ? "text-emerald-600"
                        : "text-gray-500"
                    }
                  >
                    • At least 1 number
                  </li>
                  <li
                    className={
                      PASSWORD_RULES.hasSpecial.test(password)
                        ? "text-emerald-600"
                        : "text-gray-500"
                    }
                  >
                    • At least 1 special character
                  </li>
                </ul>
              )}
            </div>

            <div className="form-field">
              <label className="form-field__label block text-sm mb-2 text-gray-700">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="form-field__input w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 outline-none transition"
                autoComplete="new-password"
                required
              />

              {confirmPassword.length > 0 && (
                <p
                  className={`form-field__match mt-2 text-xs ${
                    passwordsMatch ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {passwordsMatch
                    ? "Passwords match ✅"
                    : "Passwords do not match ❌"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`register-form__submit w-full py-3 rounded-xl text-white font-semibold shadow-md transition-all ${
                canSubmit
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {status.loading ? "Creating..." : "Sign Up"}
            </button>
          </form>

          <p className="register-form__footer text-sm text-center mt-6 text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-sky-500 hover:underline">
              Sign in here
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
