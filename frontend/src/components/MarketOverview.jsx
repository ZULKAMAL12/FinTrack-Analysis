import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  Globe,
  Newspaper,
  Loader2,
  ExternalLink,
  DollarSign,
  Activity,
  BarChart3,
} from "lucide-react";

export default function MarketOverview() {
  const [activeTab, setActiveTab] = useState("trending");
  const [category, setCategory] = useState("technology");
  const [loading, setLoading] = useState(false);
  const [trending, setTrending] = useState([]);
  const [categoryStocks, setCategoryStocks] = useState([]);
  const [news, setNews] = useState([]);

  const categories = [
    { value: "technology", label: "Technology", icon: "💻" },
    { value: "finance", label: "Finance", icon: "🏦" },
    { value: "healthcare", label: "Healthcare", icon: "🏥" },
    { value: "consumer", label: "Consumer", icon: "🛍️" },
    { value: "energy", label: "Energy", icon: "⚡" },
    { value: "malaysian", label: "Malaysian", icon: "🇲🇾" },
  ];

  const loadTrending = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/investments/market/trending`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      setTrending(data.stocks || []);
    } catch (error) {
      console.error("Failed to load trending:", error);
      setTrending([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCategoryStocks = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/investments/market/category?category=${category}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      setCategoryStocks(data.stocks || []);
    } catch (error) {
      console.error("Failed to load category stocks:", error);
      setCategoryStocks([]);
    } finally {
      setLoading(false);
    }
  };

  const loadNews = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/investments/market/news?limit=15`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      const data = await response.json();
      setNews(data.news || []);
    } catch (error) {
      console.error("Failed to load news:", error);
      setNews([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "trending") {
      loadTrending();
    } else if (activeTab === "category") {
      loadCategoryStocks();
    } else if (activeTab === "news") {
      loadNews();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, category]);

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2 bg-white/70 border border-slate-200 rounded-xl shadow-sm p-1">
        <button
          className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-medium transition ${
            activeTab === "trending"
              ? "bg-gradient-to-r from-blue-500 to-sky-600 text-white shadow-md"
              : "text-slate-700 hover:text-blue-600 hover:bg-slate-50"
          }`}
          onClick={() => setActiveTab("trending")}
          type="button"
        >
          <Activity className="w-4 h-4 inline mr-2" /> Trending
        </button>

        <button
          className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-medium transition ${
            activeTab === "category"
              ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
              : "text-slate-700 hover:text-emerald-600 hover:bg-slate-50"
          }`}
          onClick={() => setActiveTab("category")}
          type="button"
        >
          <Globe className="w-4 h-4 inline mr-2" /> By Sector
        </button>

        <button
          className={`flex-1 md:flex-none px-5 py-2.5 rounded-lg font-medium transition ${
            activeTab === "news"
              ? "bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-md"
              : "text-slate-700 hover:text-indigo-600 hover:bg-slate-50"
          }`}
          onClick={() => setActiveTab("news")}
          type="button"
        >
          <Newspaper className="w-4 h-4 inline mr-2" /> News
        </button>
      </div>

      {/* Category Filter */}
      {activeTab === "category" && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategory(cat.value)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
                category === cat.value
                  ? "bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-md"
                  : "bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:shadow-sm"
              }`}
              type="button"
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="bg-white/90 backdrop-blur-lg rounded-2xl border border-gray-100 p-6 shadow-lg">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600 mb-3" />
            <p className="text-slate-600 text-sm">Loading market data...</p>
          </div>
        ) : activeTab === "trending" ? (
          <TrendingStocksTable stocks={trending} />
        ) : activeTab === "category" ? (
          <CategoryStocksTable stocks={categoryStocks} category={category} />
        ) : (
          <NewsFeed news={news} />
        )}
      </div>
    </div>
  );
}

function TrendingStocksTable({ stocks }) {
  if (!stocks || stocks.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-600 font-medium">
          No trending stocks available
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Check back later for market updates
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Activity className="w-5 h-5 text-blue-600" />
        Trending Stocks Today
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b-2 border-slate-200 text-slate-600 text-sm font-semibold">
              <th className="py-3 pr-4">#</th>
              <th className="py-3 pr-4">Symbol</th>
              <th className="py-3 pr-4">Company</th>
              <th className="py-3 pr-4 text-right">Price</th>
              <th className="py-3 pr-4 text-right">Change</th>
              <th className="py-3 pr-4 text-right">Volume</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stocks.map((stock, idx) => (
              <tr
                key={`${stock.symbol ?? "stock"}-${idx}`}
                className="hover:bg-slate-50 transition"
              >
                <td className="py-4 pr-4">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-slate-600 font-semibold text-sm">
                    {idx + 1}
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <span className="font-mono font-bold text-blue-600 text-base">
                    {stock.symbol}
                  </span>
                </td>
                <td className="py-4 pr-4">
                  <span className="text-slate-800 font-medium">
                    {stock.name}
                  </span>
                </td>
                <td className="py-4 pr-4 text-right">
                  <span className="text-slate-900 font-semibold text-base">
                    ${Number(stock.price ?? 0).toFixed(2)}
                  </span>
                </td>
                <td className="py-4 pr-4 text-right">
                  <div
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm ${
                      Number(stock.change ?? 0) >= 0
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {Number(stock.change ?? 0) >= 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {Number(stock.change ?? 0) >= 0 ? "+" : ""}
                    {Number(stock.change ?? 0).toFixed(2)}%
                  </div>
                </td>
                <td className="py-4 pr-4 text-right text-slate-600 font-medium">
                  {Number(stock.volume ?? 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CategoryStocksTable({ stocks, category }) {
  if (!stocks || stocks.length === 0) {
    return (
      <div className="text-center py-12">
        <Loader2 className="w-10 h-10 mx-auto text-emerald-600 animate-spin mb-3" />
        <p className="text-slate-600 font-medium">
          Loading {category} stocks...
        </p>
      </div>
    );
  }

  const categoryEmoji = {
    technology: "💻",
    finance: "🏦",
    healthcare: "🏥",
    consumer: "🛍️",
    energy: "⚡",
    malaysian: "🇲🇾",
  };

  return (
    <div>
      <h3 className="text-xl font-bold text-slate-900 mb-1 capitalize flex items-center gap-2">
        <span className="text-2xl">{categoryEmoji[category] || "📊"}</span>
        {category} Sector
      </h3>
      <p className="text-sm text-slate-600 mb-6">
        Real-time market data from Yahoo Finance
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stocks.map((stock, idx) => (
          <div
            key={`${stock.symbol ?? "stock"}-${idx}`}
            className="group border-2 border-slate-200 rounded-2xl p-5 hover:border-emerald-300 hover:shadow-lg transition-all bg-gradient-to-br from-white to-slate-50"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono font-bold text-slate-900 text-lg">
                {stock.symbol}
              </span>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-green-100 flex items-center justify-center group-hover:scale-110 transition">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900">
                  ${Number(stock.price ?? 0).toFixed(2)}
                </span>
                <span className="text-sm text-slate-500">USD</span>
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold text-sm ${
                Number(stock.change ?? 0) >= 0
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              {Number(stock.change ?? 0) >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {Number(stock.change ?? 0) >= 0 ? "+" : ""}
              {Number(stock.change ?? 0).toFixed(2)}%
            </div>

            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <DollarSign className="w-3.5 h-3.5" />
                <span>24h Change</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsFeed({ news }) {
  if (!news || news.length === 0) {
    return (
      <div className="text-center py-12">
        <Newspaper className="w-12 h-12 mx-auto text-slate-300 mb-3" />
        <p className="text-slate-700 font-medium">
          Financial news not available
        </p>
        <p className="text-sm text-slate-500 mt-2">
          Add{" "}
          <code className="px-2 py-1 bg-slate-100 rounded text-xs">
            FINNHUB_API_KEY
          </code>{" "}
          to your backend .env to enable news
        </p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
        <Newspaper className="w-5 h-5 text-indigo-600" />
        Latest Financial News
      </h3>

      <div className="space-y-4">
        {news.map((item, idx) => (
          <a
            key={item.id ?? item.url ?? `${item.headline ?? "news"}-${idx}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block border-2 border-slate-200 rounded-2xl p-5 hover:border-indigo-300 hover:shadow-lg transition-all bg-white"
          >
            <div className="flex gap-5">
              {item.image && (
                <img
                  src={item.image}
                  alt={item.headline || "News"}
                  className="w-32 h-32 object-cover rounded-xl shrink-0 group-hover:scale-105 transition"
                />
              )}

              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition line-clamp-2 text-base mb-2">
                  {item.headline}
                </h4>

                <p className="text-sm text-slate-600 line-clamp-2 mb-3">
                  {item.summary}
                </p>

                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">
                    {item.source}
                  </span>
                  <span>•</span>
                  <span>
                    {item.datetime
                      ? new Date(item.datetime).toLocaleDateString()
                      : ""}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 ml-auto group-hover:text-indigo-600 transition" />
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
