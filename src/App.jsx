import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { 
  Upload, 
  Download, 
  Share2, 
  Check, 
  RefreshCw, 
  AlertCircle, 
  Camera, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Sparkles, 
  Building, 
  Search, 
  Eye, 
  X,
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react';

import ExportModal from './components/ExportModal';
import ShareModal from './components/ShareModal';

// Category presets for quick client categorization
const CATEGORY_OPTIONS = [
  'Office Supplies',
  'Meals & Entertainment',
  'Travel & Lodging',
  'Software & Subscriptions',
  'Professional Services',
  'Vehicle & Gas',
  'Utilities & Rent',
  'Equipment & Hardware',
  'Personal / Non-Business',
  'Other / Need Advice'
];

export default function App() {
  // App Navigation & Active Context
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'client'
  const [clientName, setClientName] = useState('Apex Construction LLC');
  const [activeBatchToken, setActiveBatchToken] = useState('demo_token_123');

  // Core Data State
  const [transactions, setTransactions] = useState([
    {
      id: 'txn_101',
      date: '2026-08-28',
      vendor: 'Home Depot #4402',
      amount: 142.85,
      suggested_category: 'Office Supplies',
      selected_category: null,
      client_note: '',
      receipt_url: null,
      status: 'pending'
    },
    {
      id: 'txn_102',
      date: '2026-08-29',
      vendor: 'Shell Oil Company',
      amount: 68.50,
      suggested_category: 'Vehicle & Gas',
      selected_category: 'Vehicle & Gas',
      client_note: 'Gas for work truck',
      receipt_url: null,
      status: 'completed'
    },
    {
      id: 'txn_103',
      date: '2026-08-30',
      vendor: 'Square *Coffee Roast',
      amount: 18.25,
      suggested_category: 'Meals & Entertainment',
      selected_category: null,
      client_note: '',
      receipt_url: null,
      status: 'pending'
    }
  ]);

  // Client Portal Active Selection State
  const [activeClientTxnId, setActiveClientTxnId] = useState('txn_101');
  const [previewBlobUrl, setPreviewBlobUrl] = useState(null);

  // Async Loading States
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // Modal Visibility States
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Search & Filter State in Dashboard
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Check URL parameters on mount for Magic Link Token (?token=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setActiveBatchToken(token);
      setView('client');
      // Fetch batch data from Cloudflare D1 API endpoint if live
      fetchBatchFromApi(token);
    }
  }, []);

  const fetchBatchFromApi = async (token) => {
    try {
      const res = await fetch(`/api/batch?token=${token}`);
      if (res.ok) {
        const data = await res.json();
        if (data.transactions) {
          setTransactions(data.transactions);
          if (data.client_name) setClientName(data.client_name);
          const firstPending = data.transactions.find(t => t.status === 'pending');
          if (firstPending) setActiveClientTxnId(firstPending.id);
        }
      }
    } catch (err) {
      console.log("Using local transaction state fallback:", err.message);
    }
  };

  // CSV Parsing & D1 Persistence Handler
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const parsedTxns = results.data.map((row, index) => {
          const rawAmount = row.Amount || row.amount || row.Transaction_Amount || '0';
          const cleanAmount = parseFloat(String(rawAmount).replace(/[^0-9.-]+/g, '')) || 0;
          
          return {
            id: `txn_${Date.now()}_${index}`,
            date: row.Date || row.date || new Date().toISOString().split('T')[0],
            vendor: row.Description || row.vendor || row.Payee || 'Unknown Vendor',
            amount: Math.abs(cleanAmount),
            suggested_category: 'Uncategorized',
            selected_category: null,
            client_note: '',
            receipt_url: null,
            status: 'pending'
          };
        });

        if (parsedTxns.length === 0) {
          setIsParsing(false);
          alert("No valid transaction rows found in CSV.");
          return;
        }

        // 1. Update UI state immediately
        setTransactions(parsedTxns);
        setActiveClientTxnId(parsedTxns[0].id);

        // 2. Persist to Cloudflare D1 via /api/batch
        try {
          const res = await fetch('/api/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              client_name: clientName,
              transactions: parsedTxns
            })
          });

          const data = await res.json();
          if (res.ok && data.magicToken) {
            setActiveBatchToken(data.magicToken);
          } else {
            console.warn("D1 persistence fallback:", data.error);
          }
        } catch (err) {
          console.warn("Network error saving batch to D1:", err.message);
        } finally {
          setIsParsing(false);
        }
      },
      error: (err) => {
        console.error("CSV Parse Error:", err);
        alert("Failed to parse CSV file. Please check file format.");
        setIsParsing(false);
      }
    });
  };

  // Receipt Photo Capture Handler for Client
  const handleImageCapture = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Local instant preview
    const localBlob = URL.createObjectURL(file);
    setPreviewBlobUrl(localBlob);
    setIsUploadingImage(true);

    // Save to active transaction state locally
    setTransactions(prev => prev.map(t => {
      if (t.id === activeClientTxnId) {
        return { ...t, receipt_url: localBlob };
      }
      return t;
    }));

    // Upload to Cloudflare R2 Bucket via API
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('transaction_id', activeClientTxnId);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (res.ok && data.receiptUrl) {
        setPreviewBlobUrl(data.receiptUrl);
        setTransactions(prev => prev.map(t => {
          if (t.id === activeClientTxnId) {
            return { ...t, receipt_url: data.receiptUrl };
          }
          return t;
        }));
      }
    } catch (err) {
      console.warn("R2 upload fallback (using local preview):", err.message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Update category selection & persist directly to D1
  const handleSelectCategory = async (category) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === activeClientTxnId) {
        return {
          ...t,
          selected_category: category,
          status: 'completed'
        };
      }
      return t;
    }));

    try {
      const currentTxn = transactions.find(t => t.id === activeClientTxnId);
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: activeClientTxnId,
          selected_category: category,
          client_note: currentTxn?.client_note || ''
        })
      });
    } catch (err) {
      console.warn("Failed to save category to D1:", err.message);
    }
  };

  // Update note text & persist directly to D1
  const handleNoteChange = async (noteText) => {
    setTransactions(prev => prev.map(t => {
      if (t.id === activeClientTxnId) {
        return { ...t, client_note: noteText };
      }
      return t;
    }));

    try {
      const currentTxn = transactions.find(t => t.id === activeClientTxnId);
      await fetch('/api/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_id: activeClientTxnId,
          selected_category: currentTxn?.selected_category || '',
          client_note: noteText
        })
      });
    } catch (err) {
      console.warn("Failed to save note to D1:", err.message);
    }
  };

  // Derived Values
  const activeTxn = transactions.find(t => t.id === activeClientTxnId) || transactions[0];
  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const pendingCount = transactions.filter(t => t.status === 'pending').length;

  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.vendor.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.date.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' ? true : t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased">
      
      {/* GLOBAL TOP BAR */}
      <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500 text-slate-950 font-black flex items-center justify-center rounded-xl text-lg shadow-inner">
              🐾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black tracking-tight text-lg leading-none">CatNudge</span>
                <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  v1.0 Edge
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block font-medium">Smart Client Categorization</span>
            </div>
          </div>

          {/* Mode Switcher & Global Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* View Mode Toggle Switch */}
            <div className="bg-slate-800 p-1 rounded-xl flex items-center border border-slate-700/80">
              <button
                onClick={() => setView('dashboard')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  view === 'dashboard'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Bookkeeper</span>
              </button>
              <button
                onClick={() => setView('client')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  view === 'client'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Client View</span>
              </button>
            </div>

            {/* Dashboard Action Buttons */}
            {view === 'dashboard' && (
              <>
                <button
                  onClick={() => setIsShareOpen(true)}
                  disabled={!activeBatchToken}
                  className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-sm disabled:opacity-50"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Share Link</span>
                </button>

                <button
                  onClick={() => setIsExportOpen(true)}
                  disabled={transactions.length === 0}
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl border border-slate-700 transition shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="hidden md:inline">Export CSV</span>
                </button>
              </>
            )}

          </div>
        </div>
      </header>

      {/* VIEW 1: BOOKKEEPER DASHBOARD */}
      {view === 'dashboard' && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          
          {/* Top Banner Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Total Items</span>
                <span className="text-2xl font-extrabold text-slate-900 mt-0.5 block">{transactions.length}</span>
              </div>
              <div className="p-3 bg-slate-100 text-slate-600 rounded-xl">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Needs Client Action</span>
                <span className="text-2xl font-extrabold text-amber-600 mt-0.5 block">{pendingCount}</span>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Categorized</span>
                <span className="text-2xl font-extrabold text-emerald-600 mt-0.5 block">{completedCount}</span>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* Main Controls & Toolbar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* CSV File Upload Input */}
            <div className="w-full md:w-auto">
              <label className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl cursor-pointer transition shadow">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>Upload New Bank CSV</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Search and Filters */}
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vendor or date..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs font-semibold border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Client</option>
                <option value="completed">Categorized</option>
              </select>
            </div>

          </div>

          {/* Transactions Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Vendor / Description</th>
                    <th className="py-3.5 px-4 text-right">Amount</th>
                    <th className="py-3.5 px-4">AI Suggestion</th>
                    <th className="py-3.5 px-4">Final Category</th>
                    <th className="py-3.5 px-4">Client Note / Receipt</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((txn) => (
                    <tr key={txn.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-mono text-slate-600 whitespace-nowrap">{txn.date}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{txn.vendor}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                        ${txn.amount.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                          <Sparkles className="w-3 h-3 text-emerald-500" />
                          {txn.suggested_category}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-emerald-700">
                        {txn.selected_category || '—'}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        <div className="flex items-center gap-2">
                          <span>{txn.client_note || '—'}</span>
                          {txn.receipt_url && (
                            <a
                              href={txn.receipt_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200 transition"
                              title="View Receipt Photo"
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {txn.status === 'completed' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" /> Categorized
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-400 font-medium">
                        No transactions match your search filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      )}

      {/* VIEW 2: CLIENT MOBILE PORTAL */}
      {view === 'client' && (
        <main className="max-w-md mx-auto px-4 py-6 space-y-5">
          
          {/* Mobile Portal Welcome Card */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="bg-emerald-500/20 text-emerald-400 text-xs font-bold px-2.5 py-1 rounded-lg border border-emerald-500/30">
                Action Required
              </span>
              <span className="text-xs font-mono text-slate-400">
                {pendingCount} remaining
              </span>
            </div>
            <h2 className="text-xl font-black">{clientName}</h2>
            <p className="text-xs text-slate-300">
              Tap a transaction below to select a category and snap a receipt photo for your bookkeeper.
            </p>
          </div>

          {/* Active Transaction Focus Card */}
          {activeTxn && (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/30 p-5 shadow-lg space-y-5">
              
              {/* Transaction Header */}
              <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                <div>
                  <span className="text-xs text-slate-400 font-mono block">{activeTxn.date}</span>
                  <h3 className="text-lg font-black text-slate-900">{activeTxn.vendor}</h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-slate-900 font-mono">${activeTxn.amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Category Options Pills */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
                  Select Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORY_OPTIONS.map((cat) => {
                    const isSelected = activeTxn.selected_category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => handleSelectCategory(cat)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition flex items-center justify-between ${
                          isSelected
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 ring-2 ring-emerald-500/20'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{cat}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Note Field */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Note for Bookkeeper (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Client lunch with John"
                  value={activeTxn.client_note}
                  onChange={(e) => handleNoteChange(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Snap Receipt Button & Preview */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Attach Receipt
                </label>
                
                {activeTxn.receipt_url || previewBlobUrl ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 h-32 flex items-center justify-center">
                    <img 
                      src={previewBlobUrl || activeTxn.receipt_url} 
                      alt="Receipt Preview" 
                      className="object-cover w-full h-full opacity-90"
                    />
                    <label className="absolute bottom-2 right-2 bg-slate-900/80 hover:bg-slate-900 text-white p-2 rounded-lg text-xs font-bold cursor-pointer backdrop-blur transition flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Retake</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleImageCapture} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                ) : (
                  <label className="flex items-center justify-center gap-2 border-2 border-dashed border-slate-200 hover:border-emerald-500 p-4 rounded-xl cursor-pointer transition text-slate-600 bg-slate-50 hover:bg-emerald-50/50">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold">Take Receipt Photo</span>
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

            </div>
          )}

          {/* Pending Items Selector Tabs */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block px-1">
              All Items ({transactions.length})
            </span>
            <div className="space-y-2">
              {transactions.map((txn) => {
                const isActive = txn.id === activeClientTxnId;
                return (
                  <button
                    key={txn.id}
                    onClick={() => {
                      setActiveClientTxnId(txn.id);
                      setPreviewBlobUrl(txn.receipt_url);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition flex items-center justify-between ${
                      isActive
                        ? 'border-emerald-500 bg-white shadow-md ring-2 ring-emerald-500/10'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900">{txn.vendor}</span>
                        {txn.status === 'completed' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 block">{txn.date}</span>
                    </div>
                    <span className="font-mono font-bold text-xs text-slate-900">
                      ${txn.amount.toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </main>
      )}

      {/* MODALS */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        transactions={transactions}
        clientName={clientName}
      />

      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        magicToken={activeBatchToken}
        clientName={clientName}
        pendingCount={pendingCount}
      />

    </div>
  );
}