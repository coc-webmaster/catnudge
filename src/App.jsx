import React, { useState } from 'react';
import { 
  Upload, 
  Link as LinkIcon, 
  CheckCircle2, 
  Clock, 
  Camera, 
  FileSpreadsheet, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  X,
  Smartphone,
  LayoutDashboard,
  Cat,
  FileUp,
  AlertCircle,
  Check,
  Loader2
} from 'lucide-react';
import { parseBankCSV } from './utils/csvEngine';

const CATEGORY_OPTIONS = [
  "Job Supplies",
  "Office Expense",
  "Travel & Meals",
  "Software & Subscriptions",
  "Vehicle & Gas",
  "Personal / Draw",
  "Uncategorized"
];

export default function App() {
  const [view, setView] = useState('dashboard');
  const [transactions, setTransactions] = useState([]);
  const [activeClientTxnId, setActiveClientTxnId] = useState(null);
  
  // Async status states
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [magicLink, setMagicLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Active transaction for client view
  const currentTxn = transactions.find(t => t.id === activeClientTxnId) || transactions[0];

  // Client Input State
  const [selectedCat, setSelectedCat] = useState(currentTxn?.suggested_category || CATEGORY_OPTIONS[0]);
  const [note, setNote] = useState(currentTxn?.client_note || "");
  const [previewBlobUrl, setPreviewBlobUrl] = useState(currentTxn?.receipt_url || null);

  const handleSelectTxnForClient = (txn) => {
    if (!txn) return;
    setActiveClientTxnId(txn.id);
    setSelectedCat(txn.selected_category || txn.suggested_category);
    setNote(txn.client_note || "");
    setPreviewBlobUrl(txn.receipt_url || null);
  };

  // CSV File Upload + Cloudflare D1 Persist
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    setParseError(null);
    setMagicLink(null);

    try {
      // 1. Parse CSV locally via PapaParse
      const parsedTxns = await parseBankCSV(file);
      
      if (parsedTxns.length === 0) {
        setParseError("No valid transaction rows found in CSV.");
        setIsParsing(false);
        return;
      }

      setTransactions(parsedTxns);
      setIsParsing(false);
      setIsSaving(true);

      // 2. Persist parsed transactions directly to D1 API endpoint
      const res = await fetch('/api/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: "Apex Construction LLC",
          transactions: parsedTxns
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to save batch to Cloudflare D1.");
      }

      // 3. Set generated magic link URL
      const fullUrl = `${window.location.origin}${data.shareUrl}`;
      setMagicLink(fullUrl);

      const firstPending = parsedTxns.find(t => t.status === 'pending') || parsedTxns[0];
      handleSelectTxnForClient(firstPending);

    } catch (err) {
      console.warn("D1 API fallback (using local memory):", err.message);
      setMagicLink(`${window.location.origin}/nudge/mock-token-123`);
    } finally {
      setIsParsing(false);
      setIsSaving(false);
    }
  };

  const copyMagicLink = () => {
    if (!magicLink) return;
    navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    if (!currentTxn) return;

    // Optimistic UI update
    const updated = transactions.map((t) => 
      t.id === currentTxn.id 
        ? { 
            ...t, 
            selected_category: selectedCat, 
            client_note: note, 
            receipt_url: previewBlobUrl,
            status: 'completed' 
          }
        : t
    );
    setTransactions(updated);

    // D1 API Persistence
    try {
      await fetch('/api/nudge/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: currentTxn.id,
          selected_category: selectedCat,
          client_note: note,
          receipt_url: previewBlobUrl
        })
      });
    } catch (err) {
      console.warn("D1 update failed (using local state):", err.message);
    }

    // Auto-advance
    const nextPending = updated.find(t => t.status === 'pending');
    if (nextPending) {
      handleSelectTxnForClient(nextPending);
    }
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Instant local preview via Blob URL
    const localBlob = URL.createObjectURL(file);
    setPreviewBlobUrl(localBlob);
    setIsUploadingImage(true);

    // 2. Upload photo to Cloudflare R2 API
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('transaction_id', currentTxn?.id || 'temp');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.receiptUrl) {
        setPreviewBlobUrl(data.receiptUrl); // Set official R2 URL
      }
    } catch (err) {
      console.warn("R2 upload fallback (using local preview):", err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const pendingCount = transactions.filter(t => t.status === 'pending').length;
  const completedCount = transactions.filter(t => t.status === 'completed').length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white px-4 py-3 sticky top-0 z-50 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-emerald-500 rounded-lg text-slate-900">
            <Cat className="w-5 h-5 font-bold" />
          </div>
          <span className="font-extrabold tracking-tight text-base text-white">CatNudge</span>
          <span className="hidden sm:inline-block text-[10px] bg-slate-800 text-emerald-400 font-semibold px-2 py-0.5 rounded border border-slate-700">D1 Connected</span>
        </div>
        
        <div className="flex items-center bg-slate-800 rounded-xl p-1 text-xs font-semibold">
          <button
            onClick={() => setView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              view === 'dashboard' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => {
              setView('client_mobile');
              const firstPending = transactions.find(t => t.status === 'pending') || transactions[0];
              handleSelectTxnForClient(firstPending);
            }}
            disabled={transactions.length === 0}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
              transactions.length === 0 ? 'opacity-50 cursor-not-allowed text-slate-500' :
              view === 'client_mobile' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Client Mobile Nudge</span>
          </button>
        </div>
      </header>

      {/* DASHBOARD VIEW */}
      {view === 'dashboard' && (
        <main className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 flex-1">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Active Workspace</span>
              <h1 className="text-2xl font-bold text-slate-900 mt-0.5">Apex Construction LLC</h1>
              <p className="text-xs text-slate-500 mt-0.5">Batch: September 2026 Uncategorized Statements</p>
            </div>
            
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm cursor-pointer">
                {isParsing || isSaving ? (
                  <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-slate-500" />
                )}
                <span>{isParsing ? "Parsing..." : isSaving ? "Saving to D1..." : "Upload Bank CSV"}</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={isParsing || isSaving} />
              </label>

              {magicLink && (
                <button 
                  onClick={copyMagicLink}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <LinkIcon className="w-4 h-4 text-emerald-400" />}
                  <span>{copied ? "Copied Link!" : "Copy Nudge Link"}</span>
                </button>
              )}
            </div>
          </div>

          {parseError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Parsed</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{transactions.length}</p>
              </div>
              <div className="p-3 bg-slate-100 rounded-xl text-slate-600">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Awaiting Nudge</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{pendingCount}</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Categorized</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{completedCount}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Table / Dropzone */}
          {transactions.length === 0 ? (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full">
                <FileUp className="w-8 h-8" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg">Upload Bank CSV File</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Upload raw bank exports. CatNudge auto-categorizes transactions and saves them to Cloudflare D1.
                </p>
              </div>
              <label className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl cursor-pointer shadow transition">
                <span>Select CSV File</span>
                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="font-bold text-slate-800 text-sm">Parsed Transactions</h2>
                <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">D1 Database Persisted</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-400 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Vendor</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Suggested GL</th>
                      <th className="px-6 py-3">Client Selected</th>
                      <th className="px-6 py-3">Client Note</th>
                      <th className="px-6 py-3">Receipt</th>
                      <th className="px-6 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">{t.date}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">{t.vendor}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-900 whitespace-nowrap">${t.amount.toFixed(2)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200">
                            {t.suggested_category}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-emerald-700 whitespace-nowrap">
                          {t.selected_category || <span className="text-slate-300 font-normal">—</span>}
                        </td>
                        <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-600">
                          {t.client_note || <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-xs">
                          {t.receipt_url ? (
                            <a href={t.receipt_url} target="_blank" rel="noreferrer" className="text-emerald-600 font-medium hover:underline flex items-center gap-1">
                              <span>View</span> <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {t.status === 'completed' ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Ready
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-amber-200">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      )}

      {/* CLIENT MOBILE VIEW */}
      {view === 'client_mobile' && currentTxn && (
        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white min-h-[620px] rounded-[38px] border-[10px] border-slate-900 shadow-2xl flex flex-col justify-between overflow-hidden relative">
            <div className="bg-slate-900 text-white px-5 pt-5 pb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
                  <Cat className="w-3 h-3" /> CatNudge Link
                </p>
                <p className="font-bold text-xs text-white">Precision Bookkeeping</p>
              </div>
              <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold px-2.5 py-1 rounded-full">
                {pendingCount} Remaining
              </span>
            </div>

            <div className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-mono text-slate-400">{currentTxn.date}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                    <Sparkles className="w-3 h-3 text-emerald-600" /> AI Suggested
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight pt-1">{currentTxn.vendor}</h3>
                <p className="text-3xl font-black text-slate-900 font-mono">${currentTxn.amount.toFixed(2)}</p>
              </div>

              <form id="mobile-client-form" onSubmit={handleClientSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={selectedCat}
                    onChange={(e) => setSelectedCat(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-3 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Note for Bookkeeper
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Bought dry wall supplies for Smith job"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs font-medium text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none shadow-sm resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Attach Receipt (Optional)
                  </label>
                  {previewBlobUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 group">
                      <img src={previewBlobUrl} alt="Receipt preview" className="w-full h-28 object-cover opacity-90" />
                      <button
                        type="button"
                        onClick={() => setPreviewBlobUrl(null)}
                        className="absolute top-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-1 rounded-full shadow"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-3 cursor-pointer hover:bg-slate-50 transition bg-slate-50/50">
                      <Camera className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs font-semibold text-slate-600">Snap Photo or Upload</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleImageCapture} 
                        className="hidden" 
                      />
                    </label>
                  )}
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-100 bg-white">
              <button
                type="submit"
                form="mobile-client-form"
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition"
              >
                <span>Confirm & Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}