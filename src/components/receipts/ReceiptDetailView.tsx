'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Receipt, 
  ReceiptAllocation, 
  Customer, 
  Invoice, 
  ChartOfAccount, 
  JournalEntry, 
  JournalLine,
  User
} from '@prisma/client';
import { approveReceipt, postReceipt, cancelReceipt } from '@/app/actions/receipts';

type ExtendedReceipt = Receipt & {
  customer: Customer;
  bankAccount: ChartOfAccount;
  allocations: (ReceiptAllocation & {
    invoice: Invoice;
  })[];
  journalEntry: (JournalEntry & {
    lines: (JournalLine & {
      account: ChartOfAccount;
    })[];
  }) | null;
  createdBy: User;
  approvedBy: User | null;
  postedBy: User | null;
};

interface ReceiptDetailViewProps {
  receipt: ExtendedReceipt;
}

export function ReceiptDetailView({ receipt }: ReceiptDetailViewProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const isDraft = receipt.status === 'DRAFT';
  const isApproved = receipt.status === 'APPROVED';
  const isPosted = receipt.status === 'POSTED';
  const isCancelled = receipt.status === 'CANCELLED';

  const handleApprove = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await approveReceipt(receipt.id);
      if (!res.success) {
        setError(res.error || 'Failed to approve receipt');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await postReceipt(receipt.id);
      if (!res.success) {
        setError(res.error || 'Failed to post receipt to GL');
      } else {
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setError('Cancellation reason is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await cancelReceipt(receipt.id, cancelReason);
      if (!res.success) {
        setError(res.error || 'Failed to cancel receipt');
      } else {
        setCancelModalOpen(false);
        router.refresh();
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300">DRAFT</span>;
      case 'APPROVED':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 border border-blue-200">APPROVED</span>;
      case 'POSTED':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">POSTED (GL SYNCED)</span>;
      case 'CANCELLED':
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-800 border border-rose-200">CANCELLED (REVERSED)</span>;
      default:
        return <span className="px-3 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{receipt.receiptNumber}</h1>
            {getStatusBadge(receipt.status)}
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Customer Receipt & Settlement Voucher &bull; Base Currency: AFN
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/receipts"
            className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            &larr; Back to Receipts
          </Link>

          {isDraft && (
            <button
              type="button"
              onClick={handleApprove}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
            >
              {loading ? 'Approving...' : 'Approve Receipt'}
            </button>
          )}

          {isApproved && (
            <button
              type="button"
              onClick={handlePost}
              disabled={loading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {loading ? 'Posting to GL...' : 'Post to General Ledger'}
            </button>
          )}

          {!isCancelled && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              disabled={loading}
              className="px-4 py-2 border border-rose-300 text-rose-700 hover:bg-rose-50 text-sm font-medium rounded-lg transition-colors"
            >
              Cancel Receipt
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm font-medium flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      {/* Main Grid: Details + Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Receipt Header details */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-6">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Payment & Voucher Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block">Customer</span>
              <span className="font-semibold text-slate-900 text-base">
                {receipt.customer.name} ({receipt.customer.code})
              </span>
              <span className="text-xs text-slate-400 block">{receipt.customer.email || 'No email'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Payment Date</span>
              <span className="font-medium text-slate-900">
                {new Date(receipt.paymentDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Bank / Cash Account</span>
              <span className="font-medium text-slate-900">
                {receipt.bankAccount.code} - {receipt.bankAccount.name}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Payment Method</span>
              <span className="font-medium text-slate-900">
                {receipt.paymentMethod.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Payment Reference / Trx ID</span>
              <span className="font-medium text-slate-900">
                {receipt.bankReference || 'None provided'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Exchange Rate</span>
              <span className="font-medium text-slate-900">
                1 {receipt.currency} = {Number(receipt.exchangeRate).toFixed(4)} AFN
              </span>
            </div>
          </div>

          {receipt.notes && (
            <div className="pt-2 border-t text-sm">
              <span className="text-slate-500 block mb-1">Notes / Description</span>
              <p className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">{receipt.notes}</p>
            </div>
          )}
        </div>

        {/* Amount & Settlement Summary Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold text-slate-800 border-b pb-3">Amount & Allocation</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center text-slate-600">
              <span>Receipt Amount ({receipt.currency}):</span>
              <span className="font-semibold text-slate-900">
                {Number(receipt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {receipt.currency}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Base Equivalent (AFN):</span>
              <span className="font-bold text-blue-700 text-lg">
                {Number(receipt.baseAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
              </span>
            </div>
            <div className="border-t pt-3 flex justify-between items-center text-slate-600">
              <span>Allocated to Invoices:</span>
              <span className="font-medium text-slate-900">
                {receipt.allocations.reduce((acc, curr) => acc + Number(curr.amountForeign), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {receipt.currency}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-600">
              <span>Unallocated (Customer Advance):</span>
              <span className={`font-semibold ${Number(receipt.unallocatedAmount) > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
                {Number(receipt.unallocatedAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
              </span>
            </div>
          </div>

          <div className="pt-4 border-t space-y-2 text-xs text-slate-500">
            <div>Created by: <span className="font-medium text-slate-700">{receipt.createdBy?.name || 'System User'}</span> on {new Date(receipt.createdAt).toLocaleString()}</div>
            {receipt.approvedBy && (
              <div>Approved by: <span className="font-medium text-slate-700">{receipt.approvedBy.name}</span> on {new Date(receipt.approvedAt!).toLocaleString()}</div>
            )}
            {receipt.postedBy && (
              <div>Posted to GL by: <span className="font-medium text-slate-700">{receipt.postedBy.name}</span> on {new Date(receipt.postedAt!).toLocaleString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* Invoice Allocations Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-800">Invoice Allocations & Settlement Details</h3>
            <p className="text-xs text-slate-500">Invoices settled by this payment voucher and resulting FX adjustments</p>
          </div>
        </div>

        {receipt.allocations.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            <p className="font-medium text-slate-700">Unallocated Customer Advance</p>
            <p className="text-xs text-slate-400 mt-1">This payment is recorded as an unallocated customer advance (Cr 2020 Customer Advances).</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-100/75 text-slate-700 text-xs font-semibold uppercase tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Invoice Total</th>
                  <th className="py-3 px-4">Historical Rate</th>
                  <th className="py-3 px-4 text-right">Allocated ({receipt.currency})</th>
                  <th className="py-3 px-4 text-right">Receipt AFN</th>
                  <th className="py-3 px-4 text-right">Invoice Relieved AFN</th>
                  <th className="py-3 px-4 text-right">FX Gain / (Loss)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipt.allocations.map((alloc) => {
                  const fx = Number(alloc.fxGainLossAmount);
                  return (
                    <tr key={alloc.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-semibold text-blue-600">
                        <Link href={`/invoices/${alloc.invoiceId}`} className="hover:underline">
                          {alloc.invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {Number(alloc.invoice.grandTotal).toLocaleString(undefined, { minimumFractionDigits: 2 })} {alloc.invoice.currency}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {Number(alloc.invoice.exchangeRate).toFixed(4)} AFN
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-slate-900">
                        {Number(alloc.amountForeign).toLocaleString(undefined, { minimumFractionDigits: 2 })} {receipt.currency}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-mono">
                        {Number(alloc.amountBase).toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                      </td>
                      <td className="py-3 px-4 text-right text-slate-700 font-mono">
                        {Number(alloc.invoiceSettledBase).toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold">
                        {fx > 0 ? (
                          <span className="text-emerald-600">+{fx.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN (Gain)</span>
                        ) : fx < 0 ? (
                          <span className="text-rose-600">{fx.toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN (Loss)</span>
                        ) : (
                          <span className="text-slate-400">0.00 AFN</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked General Ledger Journal Entry */}
      {receipt.journalEntry && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-5 border-b border-slate-200 bg-emerald-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-bold uppercase rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                  Posted Journal Entry
                </span>
                <h3 className="text-base font-bold text-slate-900">{receipt.journalEntry.entryNumber}</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Posted on {new Date(receipt.journalEntry.entryDate).toLocaleDateString()} &bull; Reference: {receipt.journalEntry.referenceType} ({receipt.receiptNumber})
              </p>
            </div>
            <span className="text-xs font-mono bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600">
              GL ID: {receipt.journalEntry.id}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b">
                <tr>
                  <th className="py-3 px-4">Account Code & Name</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (AFN)</th>
                  <th className="py-3 px-4 text-right">Credit (AFN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {receipt.journalEntry.lines.map((line) => {
                  const debit = Number(line.debit);
                  const credit = Number(line.credit);
                  return (
                    <tr key={line.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-sans text-slate-900 font-medium">
                        <span className="font-mono text-slate-500 mr-2">{line.account.code}</span>
                        {line.account.name}
                      </td>
                      <td className="py-2.5 px-4 font-sans text-slate-600">
                        {line.description}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                        {debit > 0 ? debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                        {credit > 0 ? credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-mono text-xs font-bold border-t">
                <tr>
                  <td colSpan={2} className="py-3 px-4 text-right font-sans text-slate-700">Total Balanced Journal:</td>
                  <td className="py-3 px-4 text-right text-emerald-700">
                    {receipt.journalEntry.lines.reduce((sum, l) => sum + Number(l.debit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700">
                    {receipt.journalEntry.lines.reduce((sum, l) => sum + Number(l.credit), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} AFN
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Cancellation Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900">Cancel Payment Receipt</h3>
            <p className="text-sm text-slate-600">
              {isPosted 
                ? 'This receipt is POSTED to the General Ledger. Cancelling it will immediately create a reversing Journal Entry in the General Ledger and restore any settled invoice balances.'
                : 'Are you sure you want to cancel this receipt?'}
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Specify the reason for cancellation / reversal..."
                rows={3}
                className="w-full text-sm border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                disabled={loading}
                className="px-4 py-2 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
              >
                Keep Receipt
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg shadow-sm disabled:opacity-50 transition-colors"
              >
                {loading ? 'Processing...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
