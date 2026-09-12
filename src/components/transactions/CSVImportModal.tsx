import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Account } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import { UploadCloud, CheckCircle2, AlertTriangle, FileText, ArrowRight } from 'lucide-react';

interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (budgetAlerts?: any[]) => void;
  accounts: Account[];
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  accounts
}) => {
  const [selectedAccountId, setSelectedAccountId] = useState<number>(accounts[0]?.id || 1);
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [previewData, setPreviewData] = useState<any>(null);
  const [parsing, setParsing] = useState<boolean>(false);
  const [importing, setImporting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const sampleCsv = `Date,Merchant,Amount,Type,Category
2026-09-08,Target Retail,42.50,expense,Shopping
2026-09-09,Starbucks Coffee,6.80,expense,Food & Dining
2026-09-10,Freelance Design Client,650.00,income,Income & Salary`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      previewCsvContent(text);
    };
    reader.readAsText(file);
  };

  const previewCsvContent = async (text: string) => {
    if (!text.trim()) return;
    setParsing(true);
    setError('');
    try {
      const res = await fetch('/api/transactions/preview-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, account_id: selectedAccountId })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to parse CSV');
      }

      const data = await res.json();
      setPreviewData(data);
    } catch (err: any) {
      setError(err.message);
      setPreviewData(null);
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!previewData || !previewData.validRows || previewData.validRows.length === 0) return;
    setImporting(true);
    setError('');

    try {
      const res = await fetch('/api/transactions/import-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: previewData.validRows })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to import transactions');
      }

      const data = await res.json();
      onSuccess(data.budgetAlerts);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const loadSample = () => {
    setCsvText(sampleCsv);
    setFileName('sample_financial_data.csv');
    previewCsvContent(sampleCsv);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Transactions via CSV"
      description="Upload bank statements or financial exports. Validates amounts, dates, and auto-detects categories."
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Account Destination */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Destination Account
          </label>
          <select
            value={selectedAccountId}
            onChange={(e) => {
              setSelectedAccountId(parseInt(e.target.value));
              if (csvText) previewCsvContent(csvText);
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            {accounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {acc.name} ({acc.type})
              </option>
            ))}
          </select>
        </div>

        {/* File Dropzone or Paste */}
        {!previewData && (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center transition bg-slate-50/50">
              <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Drag and drop your CSV file here, or browse
              </p>
              <p className="text-xs text-slate-500 mt-1">Supports columns: Date, Merchant, Amount, Category, Type</p>
              <label className="mt-4 inline-block px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold cursor-pointer shadow-xs transition">
                <span>Browse Files</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Need test data to experiment?</span>
              <button
                type="button"
                onClick={loadSample}
                className="text-emerald-600 font-bold hover:underline inline-flex items-center space-x-1"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Load Sample CSV</span>
              </button>
            </div>
          </div>
        )}

        {/* Preview and Validation Summary */}
        {previewData && (
          <div className="space-y-4 animate-in fade-in">
            {/* Stats badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-100 rounded-xl border border-slate-200">
                <span className="block text-[11px] font-semibold text-slate-500">Parsed Rows</span>
                <span className="text-lg font-bold text-slate-900">{previewData.totalParsed}</span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="block text-[11px] font-semibold text-emerald-700">Valid to Import</span>
                <span className="text-lg font-bold text-emerald-700">{previewData.validCount}</span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200">
                <span className="block text-[11px] font-semibold text-rose-700">Invalid Rows</span>
                <span className="text-lg font-bold text-rose-700">{previewData.invalidCount}</span>
              </div>
            </div>

            {/* Validation errors warning if any */}
            {previewData.invalidCount > 0 && (
              <div className="p-3 bg-rose-50/80 border border-rose-200 rounded-xl text-xs space-y-1">
                <p className="font-bold text-rose-800 flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                  <span>The following rows have issues and will be skipped:</span>
                </p>
                <ul className="list-disc pl-5 text-rose-700 space-y-0.5 max-h-24 overflow-y-auto">
                  {previewData.invalidRows.map((inv: any, idx: number) => (
                    <li key={idx}>
                      Line {inv.line}: {inv.errors.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Table Preview */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 text-xs font-bold text-slate-700 flex justify-between items-center">
                <span>Preview (First {Math.min(5, previewData.validRows.length)} valid rows)</span>
                <span className="text-[10px] text-slate-500">{fileName || 'Direct CSV Input'}</span>
              </div>
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100/70 text-slate-600 uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Merchant</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.validRows.slice(0, 5).map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 text-slate-600">{r.date}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{r.merchant}</td>
                        <td className="px-3 py-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.type === 'income' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {r.type}
                          </span>
                        </td>
                        <td className={`px-3 py-2 text-right font-bold ${
                          r.type === 'income' ? 'text-emerald-600' : 'text-slate-900'
                        }`}>
                          {formatCurrency(r.amount_cents)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setPreviewData(null);
                  setCsvText('');
                  setFileName('');
                }}
                className="text-xs text-slate-500 hover:text-slate-800 hover:underline"
              >
                ← Choose another file
              </button>

              <button
                type="button"
                onClick={handleExecuteImport}
                disabled={importing || previewData.validCount === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl shadow-sm transition flex items-center space-x-2"
              >
                <span>{importing ? 'Importing...' : `Import ${previewData.validCount} Transactions`}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
