import { supabase } from '@/config/supabase';
import type { CompanyDocumentSettings } from '@/types/database';

export async function getDocumentSettings(): Promise<CompanyDocumentSettings | null> {
  const { data, error } = await supabase.rpc('get_document_settings');
  if (error) throw error;
  if (data?.error) return null;
  return data;
}

export async function updateDocumentSettings(settings: Partial<CompanyDocumentSettings>): Promise<void> {
  const { data, error } = await supabase.rpc('update_document_settings', {
    p_company_name: settings.company_name || null,
    p_legal_name: settings.legal_name || null,
    p_tax_id: settings.tax_id || null,
    p_address: settings.address || null,
    p_phone: settings.phone || null,
    p_email: settings.email || null,
    p_website: settings.website || null,
    p_logo_path: settings.logo_path || null,
    p_header_text: settings.header_text || null,
    p_footer_text: settings.footer_text || null,
    p_primary_color: settings.primary_color || null,
    p_secondary_color: settings.secondary_color || null,
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

export async function uploadCompanyLogo(file: File): Promise<string> {
  const ext = file.name.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
  const path = `company-logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('user-signatures')
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) throw uploadError;

  await updateDocumentSettings({ logo_path: path });
  return path;
}

export async function getCompanyLogoUrl(logoPath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from('user-signatures')
    .createSignedUrl(logoPath, 3600);
  return data?.signedUrl || null;
}
