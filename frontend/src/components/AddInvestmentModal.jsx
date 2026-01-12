import { useState } from "react";
import { X, PlusCircle } from "lucide-react";

export default function AddInvestmentModal({ onClose }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Stock");
  const [amount, setAmount] = useState("");

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg p-8 shadow-2xl border border-gray-200 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <PlusCircle className="text-blue-500 w-6 h-6" /> Add New Investment
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Investment Name (e.g.,Nvidia, Tesla, Bitcoin)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 outline-none"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 outline-none"
          >
            <option>Stock</option>
            <option>ETF</option>
            <option>Crypto</option>
            <option>Gold</option>
          </select>
          <input
            type="number"
            placeholder="Amount Invested (RM)"
            Date="Date"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-400 outline-none"
          />

          <button className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-500 to-sky-600 text-white font-medium hover:opacity-90 transition">
            Add to Portfolio
          </button>
        </div>
      </div>
    </div>
  );
}
