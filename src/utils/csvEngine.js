import Papa from 'papaparse';

// Rule engine dictionary for client expense auto-categorization
const CATEGORY_RULES = [
  { category: "Job Supplies", keywords: ["home depot", "lowes", "ferguson", "lumber", "ace hardware", "sherwin"] },
  { category: "Travel & Meals", keywords: ["uber", "lyft", "airline", "delta", "starbucks", "coffee", "restaurant", "mcdonald"] },
  { category: "Software & Subscriptions", keywords: ["github", "slack", "quickbooks", "google", "aws", "adobe", "microsoft", "zoom"] },
  { category: "Vehicle & Gas", keywords: ["chevron", "shell", "exxon", "bp", "7-eleven", "autozone", "pep boys"] },
  { category: "Office Expense", keywords: ["staples", "officemax", "amazon", "ups store", "fedex"] },
];

/**
 * Predicts GL category based on vendor description text
 */
export function suggestCategory(vendorName) {
  if (!vendorName) return "Uncategorized";
  const cleanVendor = vendorName.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((kw) => cleanVendor.includes(kw))) {
      return rule.category;
    }
  }
  return "Uncategorized";
}

/**
 * Parses raw CSV content using PapaParse and normalizes fields into CatNudge schema
 */
export function parseBankCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        try {
          const rawRows = results.data;
          if (!rawRows || rawRows.length === 0) {
            return resolve([]);
          }

          // Detect column headers flexibly
          const sample = rawRows[0];
          const keys = Object.keys(sample);

          const dateKey = keys.find(k => /date/i.test(k)) || keys[0];
          const vendorKey = keys.find(k => /(vendor|description|payee|name|memo)/i.test(k)) || keys[1];
          const amountKey = keys.find(k => /(amount|total|debit)/i.test(k)) || keys[2];

          // Map into normalized CatNudge JSON schema
          const normalized = rawRows.map((row, idx) => {
            const rawAmount = row[amountKey];
            const parsedAmount = typeof rawAmount === 'number' 
              ? Math.abs(rawAmount) 
              : parseFloat(String(rawAmount || 0).replace(/[^0-9.-]+/g, ""));

            const vendorStr = String(row[vendorKey] || "Unknown Vendor").trim();
            const suggested = suggestCategory(vendorStr);

            return {
              id: `txn_${Date.now()}_${idx}`,
              date: String(row[dateKey] || new Date().toISOString().split('T')[0]).trim(),
              vendor: vendorStr,
              amount: isNaN(parsedAmount) ? 0.00 : parsedAmount,
              suggested_category: suggested,
              selected_category: "",
              client_note: "",
              receipt_url: null,
              status: "pending"
            };
          });

          resolve(normalized);
        } catch (err) {
          reject(err);
        }
      },
      error: (error) => reject(error)
    });
  });
}