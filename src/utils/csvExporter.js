import Papa from 'papaparse';

/**
 * Transforms transaction records into target accounting software CSV formats
 * and triggers a native browser download.
 */
export function exportTransactionsCSV(transactions, options = {}) {
  const {
    format = 'quickbooks', // 'quickbooks' | 'xero' | 'universal'
    filter = 'completed',  // 'completed' | 'all'
    clientName = 'Client'
  } = options;

  const filteredTxns = transactions.filter((t) => {
    if (filter === 'completed') return t.status === 'completed';
    return true;
  });

  if (filteredTxns.length === 0) {
    alert("No transactions match the selected export filter.");
    return;
  }

  let exportData = [];

  switch (format) {
    case 'quickbooks':
      exportData = filteredTxns.map((t) => ({
        "Date": t.date,
        "Description": t.vendor,
        "Amount": t.amount,
        "Category": t.selected_category || t.suggested_category || "Uncategorized",
        "Memo": t.client_note || ""
      }));
      break;

    case 'xero':
      exportData = filteredTxns.map((t) => ({
        "*Date": t.date,
        "*Amount": t.amount,
        "Payee": t.vendor,
        "Description": t.client_note || "CatNudge Categorized Expense",
        "Reference": t.id,
        "Account Code / Category": t.selected_category || t.suggested_category || "Uncategorized"
      }));
      break;

    case 'universal':
    default:
      exportData = filteredTxns.map((t) => ({
        "Transaction ID": t.id,
        "Date": t.date,
        "Vendor / Payee": t.vendor,
        "Amount": t.amount,
        "Final Category": t.selected_category || t.suggested_category || "Uncategorized",
        "AI Suggested Category": t.suggested_category,
        "Client Note": t.client_note || "",
        "Receipt URL": t.receipt_url || "",
        "Status": t.status
      }));
      break;
  }

  const csvString = Papa.unparse(exportData);
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  const sanitizedClient = clientName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const dateStr = new Date().toISOString().split('T')[0];
  
  link.setAttribute('href', url);
  link.setAttribute('download', `catnudge_${sanitizedClient}_${format}_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}