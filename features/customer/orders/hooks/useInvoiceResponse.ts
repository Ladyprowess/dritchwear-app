import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { formatInvoiceAmount } from '@/lib/formatting';
import type { Order, Invoice } from '../types';

export function useInvoiceResponse(
  preferredCurrency: string | null | undefined,
  onSuccess: () => Promise<void>,
  onError: (message: string) => void
) {
  const [processingInvoice, setProcessingInvoice] = useState<string | null>(null);

  const handleAcceptInvoice = async (invoice: Invoice, customRequest: Order) => {
    setProcessingInvoice(invoice.id);

    try {
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'accepted' })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      const { error: requestError } = await supabase
        .from('custom_requests')
        .update({ status: 'accepted' })
        .eq('id', customRequest.id);

      if (requestError) throw requestError;

      const { error: notifyError } = await supabase.rpc('notify_admins', {
        p_title: 'Invoice Accepted',
        p_message: `Customer has accepted invoice for "${customRequest.title}" - Amount: ${formatInvoiceAmount(invoice, preferredCurrency)}`,
        p_type: 'custom',
      });

      if (notifyError) console.warn('notify_admins failed:', notifyError);

      await onSuccess();
    } catch (error) {
      console.error('Error accepting invoice:', error);
      onError('The invoice could not be accepted. Please try again.');
    } finally {
      setProcessingInvoice(null);
    }
  };

  const handleRejectInvoice = async (invoice: Invoice, customRequest: Order) => {
    setProcessingInvoice(invoice.id);

    try {
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ status: 'rejected' })
        .eq('id', invoice.id);

      if (invoiceError) throw invoiceError;

      const { error: requestError } = await supabase
        .from('custom_requests')
        .update({ status: 'rejected' })
        .eq('id', customRequest.id);

      if (requestError) throw requestError;

      const { error: notifyError } = await supabase.rpc('notify_admins', {
        p_title: 'Invoice Rejected',
        p_message: `Customer has rejected invoice for "${customRequest.title}" - Amount: ${formatInvoiceAmount(invoice, preferredCurrency)}`,
        p_type: 'custom',
      });

      if (notifyError) {
        console.warn('notify_admins failed:', notifyError);
      }

      await onSuccess();
    } catch (error) {
      console.error('Error rejecting invoice:', error);
      onError('The invoice could not be rejected. Please try again.');
    } finally {
      setProcessingInvoice(null);
    }
  };

  return { processingInvoice, handleAcceptInvoice, handleRejectInvoice };
}
