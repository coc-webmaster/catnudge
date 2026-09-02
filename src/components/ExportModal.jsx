import React, { useState } from 'react';
import { Download, X, FileSpreadsheet, CheckCircle2 } from 'lucide-react';
import { exportTransactionsCSV } from '../utils/csvExporter';

export default function ExportModal({ isOpen, onClose, transactions, clientName }) {
  const [format, setFormat] = useState('quickbooks');
  const [filter, setFilter] = useState('completed');

  if (!isOpen) return null;

  const completedCount = transactions.filter(t => t.status === 'completed').length;
  const totalCount = transactions.length;

  const handleExport = () => {
    exportTransactionsCSV(transactions, { format, filter, clientName });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-500 text-slate-900 rounded-lg">
              <Download className="w-4 h-4 font-bold" />
            </div>
            <h3 className="font-bold text-base">Export Transactions CSV</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Accounting Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormat('quickbooks')}
                className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
                  format === 'quickbooks'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                QuickBooks
              </button>
              <button
                type="button"
                onClick={() => setFormat('xero')}
                className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
                  format === 'xero'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Xero
              </button>
              <button
                type="button"
                onClick={() => setFormat('universal')}
                className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
                  format === 'universal'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Audit CSV
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Records to Include
            </label>
            <div className="space-y-2">
              <button 
                type="button"
                onClick={() => setFilter('completed')}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition ${
                  filter === 'completed'
                    ? 'border-emerald-500 bg-emerald-50/50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold">Only Categorized Items</span>
                </div>
                <span className="text-xs font-mono font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">
                  {completedCount} rows
                </span>
              </button>

              <button 
                type="button"
                onClick={() => setFilter('all')}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl border transition ${
                  filter === 'all'
                    ? 'border-emerald-500 bg-emerald-50/50 text-slate-900'
                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-bold">All Transactions</span>
                </div>
                <span className="text-xs font-mono font-extrabold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                  {totalCount} rows
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow transition"
          >
            <Download className="w-4 h-4" />
            <span>Download CSV</span>
          </button>
        </div>

      </div>
    </div>
  );
}