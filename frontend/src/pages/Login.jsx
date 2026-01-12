import { Link } from "react-router-dom";
import illustration from "../assets/finance-illustration.svg";

export default function Login() {
  return (
    <main className="relative flex items-center justify-center min-h-[calc(100vh-5rem)] overflow-hidden bg-gradient-to-br from-[#eef4ff] via-[#e4ecff] to-[#dae6ff]">
      {/* Decorative gradient blobs */}
      <div className="absolute w-[500px] h-[500px] bg-sky-300/20 rounded-full blur-3xl top-[-150px] left-[-150px]" />
      <div className="absolute w-[400px] h-[400px] bg-blue-400/10 rounded-full blur-2xl bottom-[-100px] right-[-100px]" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-center bg-white/60 backdrop-blur-md rounded-3xl shadow-2xl border border-white/30 p-10 md:p-12 gap-12 max-w-5xl w-[95%]">
        {/* Illustration + Welcome Text */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left md:w-1/2 space-y-6">
          <img
            src={illustration}
            alt="Finance Illustration"
            className="w-64 md:w-72 drop-shadow-md"
          />
          <h2 className="text-2xl md:text-3xl font-bold text-[#0b1222]">
            Welcome Back to{" "}
            <span className="text-sky-500">FinTrack</span>
          </h2>
          <p className="text-gray-600 text-sm md:text-base leading-relaxed max-w-sm">
            Manage your money smarter — track spending, savings, and
            investments all in one secure place.
          </p>
        </div>

        {/* Login Form */}
        <div className="w-full md:w-1/2 max-w-sm bg-white/70 rounded-2xl border border-gray-100 shadow-lg p-8">
          <h1 className="text-2xl font-bold text-center mb-2 bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
            Sign In
          </h1>
          <p className="text-center text-gray-500 mb-6">
            Access your personal dashboard
          </p>

          <form className="space-y-5">
            <div>
              <label className="block text-sm mb-2 text-gray-700">Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-2 text-gray-700">
                Password
              </label>
              <input
                type="password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-sky-400 outline-none transition"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold hover:from-sky-600 hover:to-blue-700 shadow-md transition-all"
            >
              Sign In
            </button>
          </form>

          <p className="text-sm text-center mt-6 text-gray-600">
            Don’t have an account?{" "}
            <Link to="/register" className="text-sky-500 hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
