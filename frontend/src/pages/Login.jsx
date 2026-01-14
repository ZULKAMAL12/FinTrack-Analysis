import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import illustration from "../assets/finance-illustration.svg";

async function apiLogin({ email, password }) {
  const base = import.meta.env.VITE_API_URL;
  if (!base) throw new Error("Missing VITE_API_URL in frontend .env");

  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!res.ok) throw new Error(data.message || "Login failed");
  return data; // { token, user }
}

export default function Login() {
  const nav = useNavigate();

  // form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ui state
  const [status, setStatus] = useState({
    loading: false,
    error: "",
    success: "",
  });

  const canSubmit = !status.loading && email.trim() && password;

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ loading: true, error: "", success: "" });

    const normalizedEmail = email.trim().toLowerCase();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setStatus({
        loading: false,
        error: "Please enter a valid email.",
        success: "",
      });
      return;
    }

    try {
      const data = await apiLogin({ email: normalizedEmail, password });

      if (data?.token) localStorage.setItem("token", data.token);

      setStatus({
        loading: false,
        error: "",
        success: "Signed in! Redirecting...",
      });

      // Go to dashboard (change route if your app uses a different path)
      setTimeout(() => nav("/dashboard"), 400);
    } catch (err) {
      setStatus({
        loading: false,
        error: err?.message || "Login failed.",
        success: "",
      });
    }
  }

  return (
    <main className="login-page relative flex items-center justify-center min-h-[calc(100vh-5rem)] overflow-hidden bg-gradient-to-br from-[#eef4ff] via-[#e4ecff] to-[#dae6ff]">
      {/* Decorative gradient blobs */}
      <div className="login-page__glow login-page__glow--top absolute w-[500px] h-[500px] bg-sky-300/20 rounded-full blur-3xl top-[-150px] left-[-150px]" />
      <div className="login-page__glow login-page__glow--bottom absolute w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-2xl bottom-[-100px] right-[-100px]" />

      <div className="login-card relative z-10 flex flex-col md:flex-row items-center justify-center bg-white/60 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 p-10 md:p-12 gap-12 max-w-5xl w-[95%]">
        {/* Illustration + Welcome Text */}
        <section className="login-card__intro flex flex-col items-center md:items-start text-center md:text-left md:w-1/2 space-y-6">
          <img
            src={illustration}
            alt="Finance Illustration"
            className="login-card__illustration w-64 md:w-72 drop-shadow-md"
          />
          <h2 className="login-card__title text-2xl md:text-3xl font-bold text-[#0b1222]">
            Welcome Back to <span className="text-sky-500">FinTrack</span>
          </h2>
          <p className="login-card__subtitle text-gray-600 text-sm md:text-base leading-relaxed max-w-sm">
            Manage your money smarter — track spending, savings, and investments
            all in one secure place.
          </p>
        </section>

        {/* Login Form */}
        <section className="login-form w-full md:w-1/2 max-w-sm bg-white/70 rounded-2xl border border-gray-100 shadow-lg p-8">
          <header className="login-form__header">
            <h1 className="login-form__heading text-2xl font-bold text-center mb-2 bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
              Sign In
            </h1>
            <p className="login-form__desc text-center text-gray-500 mb-6">
              Access your personal dashboard
            </p>
          </header>

          {(status.error || status.success) && (
            <div
              className={`login-form__alert mb-5 rounded-xl px-4 py-3 text-sm border ${
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

          <form className="login-form__body space-y-5" onSubmit={handleSubmit}>
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
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className={`login-form__submit w-full py-3 rounded-xl text-white font-semibold shadow-md transition-all ${
                canSubmit
                  ? "bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {status.loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="login-form__footer text-sm text-center mt-6 text-gray-600">
            Don’t have an account?{" "}
            <Link to="/register" className="text-sky-500 hover:underline">
              Create one
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
