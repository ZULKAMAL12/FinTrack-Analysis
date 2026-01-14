import { Link } from "react-router-dom";
import {
  Wallet,
  BarChart3,
  PieChart,
  LineChart,
  ShieldCheck,
  Smartphone,
  Globe2,
  Users,
  Sparkles,
} from "lucide-react";
import illustration from "../assets/finance-illustration.svg";
import Logo from "../assets/FullLogo.png"; // <-- LOGO

export default function Landing() {
  return (
    <main className="relative flex flex-col text-[#0f172a] font-inter overflow-hidden bg-gradient-to-b from-[#f9fbff] via-[#ecf2ff] to-[#dde9ff]">
      {/* Background Design */}
      <div className="absolute inset-0 overflow-hidden -z-10">
        <div className="absolute w-[600px] h-[600px] bg-sky-300/25 rounded-full blur-3xl top-[-200px] left-[-150px]" />
        <div className="absolute w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl bottom-[-150px] right-[-200px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/subtle-prism.png')] opacity-[0.05]" />
      </div>

      {/* ============================
            BRAND LOGO BLOCK
      ============================= */}
      <div className="flex justify-center pt-14 md:pt-16">
        <div className="flex justify-center pt-14 md:pt-16">
          <img
            src={Logo}
            alt="FinTrack logo"
            className="w-auto max-w-[380px] drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]"
          />
        </div>
      </div>

      {/* HERO SECTION */}
      <section className="flex flex-col md:flex-row items-center justify-center gap-12 px-8 md:px-20 py-20 relative z-10">
        <div
          className="max-w-xl space-y-6 text-center md:text-left"
          data-aos="fade-right"
        >
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight text-[#0b1222] drop-shadow-sm">
            Simplify Your{" "}
            <span className="bg-gradient-to-r from-sky-500 to-blue-600 bg-clip-text text-transparent">
              Finances
            </span>{" "}
            — Smarter, Faster, Local.
          </h1>

          <p className="text-gray-600 text-base md:text-lg leading-relaxed">
            FinTrack helps Malaysians manage expenses, savings, and investments
            — all in one secure dashboard. Make better decisions with powerful
            insights and intuitive visual tools.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-4 justify-center md:justify-start">
            <Link
              to="/register"
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 text-white font-semibold hover:shadow-lg hover:scale-[1.02] transition-all"
            >
              Get Started Free
            </Link>
            <Link
              to="/login"
              className="px-8 py-3 rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-800 font-medium transition"
            >
              Sign In
            </Link>
          </div>
        </div>

        <div
          data-aos="fade-left"
          className="flex justify-center md:justify-end relative"
        >
          <img
            src={illustration}
            alt="Finance Illustration"
            className="w-72 md:w-[420px] drop-shadow-2xl relative z-10"
          />
          <div className="absolute w-80 h-80 bg-sky-400/20 blur-3xl rounded-full top-10 left-10 -z-10" />
        </div>
      </section>

      {/* SVG Divider */}
      <svg
        className="absolute bottom-[-1px] left-0 right-0"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1440 320"
      >
        <path
          fill="#ffffff"
          d="M0,224L80,213.3C160,203,320,181,480,181.3C640,181,800,203,960,224C1120,245,1280,267,1360,277.3L1440,288V320H0Z"
        ></path>
      </svg>

      {/* ============================
            HOW IT WORKS
      ============================= */}
      <section className="bg-white py-28 px-8 md:px-20 relative z-10">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-[#0b1222]">
          How FinTrack Works
        </h2>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {[
            {
              title: "1. Connect & Set Goals",
              desc: "Create an account and define your savings or investment goals with easy customization.",
            },
            {
              title: "2. Track & Organize",
              desc: "Record transactions manually or through uploads, auto-categorized into meaningful groups.",
            },
            {
              title: "3. Visualize & Grow",
              desc: "Get instant insights and beautiful analytics — see progress and ROI at a glance.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="bg-gradient-to-b from-[#f9fbff] to-white p-8 rounded-2xl shadow-md border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition"
            >
              <h3 className="text-sky-600 font-semibold mb-3 text-lg">
                {item.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================
            SMART DASHBOARD
      ============================= */}
      <section className="py-28 px-8 md:px-20 bg-gradient-to-b from-[#ffffff] to-[#edf3ff]">
        <div className="max-w-6xl mx-auto text-center space-y-8">
          <h2 className="text-3xl md:text-4xl font-bold text-[#0b1222]">
            Smart Insights, Beautiful Dashboards
          </h2>

          <p className="text-gray-600 max-w-2xl mx-auto">
            FinTrack isn’t just about recording — it’s about understanding. Get
            detailed breakdowns of where your money goes, how much you save, and
            how your investments perform over time.
          </p>

          <img
            src="/src/assets/dashboard-preview.png"
            alt="Dashboard Preview"
            className="mx-auto rounded-2xl shadow-2xl border border-gray-200 hover:scale-[1.02] transition-all"
          />
        </div>
      </section>

      {/* ============================
            UNIQUE ADVANTAGES
      ============================= */}
      <section className="py-28 px-8 md:px-20 bg-gradient-to-b from-[#eef4ff] to-[#dbe8ff]">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-[#0b1222]">
          Why Choose FinTrack-Analysis?
        </h2>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto">
          {[
            {
              icon: <Globe2 className="w-10 h-10 text-sky-500" />,
              title: "Localized for Malaysia",
              desc: "Track MYR-based expenses, savings, and gold investments — designed for local users.",
            },
            {
              icon: <Sparkles className="w-10 h-10 text-sky-500" />,
              title: "AI-Assisted Categorization",
              desc: "Get auto-suggestions and insights on spending habits using lightweight AI logic.",
            },
            {
              icon: <ShieldCheck className="w-10 h-10 text-sky-500" />,
              title: "Privacy & Security",
              desc: "Your data is fully encrypted and processed only on your secured environment.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="p-8 bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition text-center"
            >
              <div className="flex justify-center mb-3">{item.icon}</div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================
            TESTIMONIALS
      ============================= */}
      <section className="py-24 px-6 md:px-16 bg-white border-t border-gray-200">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-[#0b1222]">
          Trusted by Students & Professionals
        </h2>

        <div className="grid md:grid-cols-3 gap-10 max-w-6xl mx-auto text-center">
          {[
            {
              quote:
                "FinTrack helped me visualize my expenses like never before. It’s clean, fast, and made for Malaysians.",
              name: "Nur Aina — University Student",
            },
            {
              quote:
                "A complete tool for both budgeting and investments. I track Versa and ASB returns monthly now.",
              name: "Hakim — Finance Enthusiast",
            },
            {
              quote:
                "Beautiful interface and simple UI. I love how it shows goals clearly. Highly recommend it.",
              name: "Siti Zulaikha — Software Engineer",
            },
          ].map((t, i) => (
            <div
              key={i}
              className="bg-gradient-to-b from-[#f9fbff] to-white p-8 rounded-2xl shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition"
            >
              <p className="text-gray-700 italic mb-4">“{t.quote}”</p>
              <p className="text-sky-600 font-semibold text-sm">{t.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============================
            FINAL CTA
      ============================= */}
      <section className="py-28 text-center px-6 md:px-16 bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diamond-upholstery.png')] opacity-[0.08]" />

        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 drop-shadow">
            Start your journey to financial clarity today.
          </h2>

          <Link
            to="/register"
            className="px-8 py-3 rounded-xl bg-white text-sky-700 font-semibold hover:bg-gray-100 transition shadow-lg"
          >
            Create Your Free Account
          </Link>

          <p className="mt-3 text-sm text-white/80">
            FinTrack — designed for clarity, built for Malaysians 🇲🇾
          </p>
        </div>
      </section>
    </main>
  );
}
