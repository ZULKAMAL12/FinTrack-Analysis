import { useState, useEffect, useRef } from "react";
import { Search, X, Loader2, TrendingUp, Building2, Globe } from "lucide-react";

export default function StockSearch({ onSelect, onClose }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const searchTimeoutRef = useRef(null);

  const searchStocks = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/investments/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!response.ok) throw new Error("Search failed");

      const data = await response.json();
      setResults(data.results || []);
    } catch (error) {
      console.error("Stock search error:", error);
      setError("Failed to search. Try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        searchStocks(query);
      }, 300);
    } else {
      setResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-20 px-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        role="button"
        tabIndex={0}
        aria-label="Close modal"
        onKeyDown={(e) => e.key === "Enter" && onClose()}
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Search Input */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-4 border-b border-slate-200">
          <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 shadow-sm border border-slate-200">
            <Search className="w-5 h-5 text-slate-400 shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search stocks by name or symbol (e.g., Tesla, AAPL, Microsoft)..."
              className="flex-1 outline-none text-base text-slate-900 placeholder:text-slate-400"
              autoFocus
            />
            {loading && (
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition shrink-0"
              aria-label="Close search"
            >
              <X className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto bg-white">
          {error && (
            <div className="p-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm">
                <X className="w-4 h-4" />
                {error}
              </div>
            </div>
          )}

          {!loading && !error && query.length >= 2 && results.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-700 font-medium">
                No results found for "{query}"
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Try searching by company name or ticker symbol
              </p>
            </div>
          )}

          {!loading && query.length < 2 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-sky-100 flex items-center justify-center">
                <Search className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-slate-700 font-medium mb-2">
                Start typing to search stocks and ETFs
              </p>
              <div className="inline-flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
                <span className="px-2 py-1 bg-slate-100 rounded">Tesla</span>
                <span className="px-2 py-1 bg-slate-100 rounded">AAPL</span>
                <span className="px-2 py-1 bg-slate-100 rounded">
                  Microsoft
                </span>
                <span className="px-2 py-1 bg-slate-100 rounded">VOO</span>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="divide-y divide-slate-100">
              {results.map((stock, index) => (
                <button
                  key={index}
                  onClick={() => onSelect(stock)}
                  className="w-full p-4 hover:bg-slate-50 transition text-left flex items-center gap-4 group"
                >
                  {/* Icon */}
                  <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 flex items-center justify-center group-hover:from-blue-100 group-hover:to-sky-100 transition">
                    {stock.type === "etf" ? (
                      <Building2 className="w-6 h-6 text-blue-600" />
                    ) : (
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono font-bold text-slate-900 text-base">
                        {stock.symbol}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-xs font-semibold ${
                          stock.type === "etf"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {stock.type.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-700 truncate mb-0.5">
                      {stock.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Globe className="w-3 h-3" />
                      <span>{stock.exchange}</span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100 flex items-center justify-center transition">
                      <TrendingUp className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
