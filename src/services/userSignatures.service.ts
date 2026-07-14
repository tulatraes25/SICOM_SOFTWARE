import { supabase } from '@/config/supabase';
import type { UserSignature, SignatureType } from '@/types/database';

const BUCKET = 'user-signatures';

export async function getMyActiveSignature(type: SignatureType): Promise<UserSignature | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('user_signatures')
    .select('*')
    .eq('user_id', user.id)
    .eq('signature_type', type)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getMySignatures(): Promise<UserSignature[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_signatures')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadSignature(
  file: File,
  signatureType: SignatureType
): Promise<UserSignature> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  // Validate file
  if (file.size > 2 * 1024 * 1024) {
    throw new Error('La imagen supera el límite de 2 MB');
  }

  const validTypes = ['image/png', 'image/jpeg'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Solo se permiten archivos PNG o JPEG');
  }

  // Generate storage path using auth.uid()
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const signatureId = crypto.randomUUID();
  const storagePath = `users/${user.id}/${signatureId}.${ext}`;

  // Step 1: Upload file to storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type });

  if (uploadError) {
    console.error('[uploadSignature] Storage upload error:', uploadError);
    throw new Error('No se pudo subir el archivo. Verificá tu sesión e intentá nuevamente.');
  }

  // Step 2: Create record via RPC (handles revocation of old signature + insert)
  const { data: rpcData, error: rpcError } = await supabase.rpc('create_user_signature', {
    p_signature_type: signatureType,
    p_storage_path: storagePath,
    p_original_filename: file.name,
    p_mime_type: file.type,
    p_file_size: file.size,
  });

  if (rpcError) {
    console.error('[uploadSignature] RPC error:', rpcError);
    // Rollback: remove uploaded file
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error('No se pudo registrar la firma. Verificá tu sesión e intentá nuevamente.');
  }

  if (rpcData?.error) {
    console.error('[uploadSignature] RPC business error:', rpcData.error);
    // Rollback: remove uploaded file
    await supabase.storage.from(BUCKET).remove([storagePath]);
    throw new Error(rpcData.error);
  }

  // Return the created signature
  return {
    id: rpcData.id,
    user_id: user.id,
    signature_type: rpcData.signature_type,
    storage_path: rpcData.storage_path,
    mime_type: file.type,
    file_size: file.size,
    is_active: true,
    uploaded_by: user.id,
    created_at: rpcData.created_at,
    updated_at: rpcData.created_at,
  } as UserSignature;
}

export async function revokeSignature(signatureId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('No autenticado');

  const { error } = await supabase
    .from('user_signatures')
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      revoked_by: user.id,
    })
    .eq('id', signatureId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function getSignatureUrl(storagePath: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl || null;
}

export async function getUserSignatureForPDF(
  userId: string,
  signatureType: SignatureType
): Promise<{ storagePath: string; signedUrl: string } | null> {
  const { data, error } = await supabase
    .from('user_signatures')
    .select('storage_path')
    .eq('user_id', userId)
    .eq('signature_type', signatureType)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const url = await getSignatureUrl(data.storage_path);
  if (!url) return null;

  return { storagePath: data.storage_path, signedUrl: url };
}
