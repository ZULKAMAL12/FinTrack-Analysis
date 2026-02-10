import InvestmentAsset from "../models/InvestmentAsset.js";
import InvestmentTransaction from "../models/InvestmentTransaction.js";
import logger from "../utils/logger.js";

function csvEscape(val) {
  if (val === null || val === undefined) return "";
  let s = String(val);

  // Prevent CSV injection
  if (/^[=+\-@]/.test(s)) {
    s = "'" + s;
  }

  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Export transactions as CSV
 */
export async function exportTransactions(req, res) {
  const userId = req.user._id;

  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const assetId =
      req.query.assetId && req.query.assetId !== "all"
        ? req.query.assetId
        : null;

    const filter = { userId };
    if (year) filter.year = year;
    if (assetId) filter.assetId = assetId;

    const transactions = await InvestmentTransaction.find(filter)
      .sort({ year: -1, month: -1, day: -1, createdAt: -1 })
      .lean();

    if (transactions.length === 0) {
      return res.status(404).json({
        message: "No transactions found for export",
      });
    }

    // CSV header
    const headers = [
      "Date",
      "Asset Symbol",
      "Asset Name",
      "Type",
      "Units",
      "Price per Unit",
      "Total Amount",
      "Currency",
      "Notes",
    ];

    // CSV rows
    const rows = transactions.map((tx) => {
      const date = tx.day
        ? `${tx.day}/${tx.month}/${tx.year}`
        : `${tx.month}/${tx.year}`;

      return [
        csvEscape(date),
        csvEscape(tx.assetSymbol),
        csvEscape(tx.assetName),
        csvEscape(tx.type),
        csvEscape(tx.units),
        csvEscape(tx.pricePerUnit),
        csvEscape(tx.totalAmount),
        csvEscape(tx.currency),
        csvEscape(tx.notes),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    const filename = year
      ? `investments_transactions_${year}.csv`
      : `investments_transactions_all.csv`;

    logger.info("Transactions exported", {
      userId,
      year,
      assetId,
      count: transactions.length,
      ip: req.ip,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    logger.error("Export transactions error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to export transactions",
    });
  }
}

/**
 * Export assets summary as CSV
 */
export async function exportAssets(req, res) {
  const userId = req.user._id;

  try {
    const assets = await InvestmentAsset.find({
      userId,
      deletedAt: null,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (assets.length === 0) {
      return res.status(404).json({
        message: "No assets found for export",
      });
    }

    // CSV header
    const headers = [
      "Symbol",
      "Name",
      "Type",
      "Exchange",
      "Currency",
      "Total Units",
      "Total Invested",
      "Last Known Price",
      "Market Value (Estimated)",
      "Profit/Loss (Estimated)",
      "ROI % (Estimated)",
    ];

    // CSV rows
    const rows = assets.map((asset) => {
      const marketValue = asset.totalUnits * asset.lastKnownPrice;
      const profitLoss = marketValue - asset.totalInvested;
      const roi =
        asset.totalInvested > 0
          ? ((profitLoss / asset.totalInvested) * 100).toFixed(2)
          : 0;

      return [
        csvEscape(asset.symbol),
        csvEscape(asset.name),
        csvEscape(asset.type),
        csvEscape(asset.exchange),
        csvEscape(asset.currency),
        csvEscape(asset.totalUnits),
        csvEscape(asset.totalInvested),
        csvEscape(asset.lastKnownPrice),
        csvEscape(marketValue.toFixed(2)),
        csvEscape(profitLoss.toFixed(2)),
        csvEscape(roi),
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");

    const filename = `investments_assets_summary.csv`;

    logger.info("Assets exported", {
      userId,
      count: assets.length,
      ip: req.ip,
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    logger.error("Export assets error:", {
      userId,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      message: "Failed to export assets",
    });
  }
}
