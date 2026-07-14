import { supabase } from '@/config/supabase';
import type { DocumentSignature, DocumentSignatureType } from '@/types/database';

export async function signDocument(
  documentType: DocumentSignatureType,
  documentId: string,
  serviceCaseId?: string,
  signerRole?: string
): Promise<DocumentSignature> {
  const { data, error } = await supabase.rpc('sign_document', {
    p_document_type: documentType,
    p_document_id: documentId,
    p_service_case_id: serviceCaseId || null,
    p_signer_role: signerRole || null,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function getDocumentSignatures(
  documentType: DocumentSignatureType,
  documentId: string
): Promise<DocumentSignature[]> {
  const { data, error } = await supabase
    .from('document_signatures')
    .select(`
      *,
      signer:profiles(full_name, email, role),
      signature:user_signatures(storage_path)
    `)
    .eq('document_type', documentType)
    .eq('document_id', documentId)
    .order('signed_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function listDocumentSignatures(filters?: {
  document_type?: string;
  signer_user_id?: string;
  service_case_id?: string;
  limit?: number;
  offset?: number;
}): Promise<{ data: DocumentSignature[]; count: number }> {
  let query = supabase
    .from('document_signatures')
    .select(`
      *,
      signer:profiles(full_name, email, role)
    `, { count: 'exact' })
    .order('signed_at', { ascending: false });

  if (filters?.document_type) query = query.eq('document_type', filters.document_type);
  if (filters?.signer_user_id) query = query.eq('signer_user_id', filters.signer_user_id);
  if (filters?.service_case_id) query = query.eq('service_case_id', filters.service_case_id);

  const from = filters?.offset || 0;
  const to = from + (filters?.limit || 50) - 1;
  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) throw error;
  return { data: data || [], count: count || 0 };
}
