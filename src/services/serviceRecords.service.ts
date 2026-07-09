import { supabase } from '@/config/supabase';
import type { ServiceRecord, ServiceChecklistItem, ServicePhoto } from '@/types/database';

export async function listMyServiceRecords(technicianId: string): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from('service_records')
    .select('*, elevator:elevators(code, building:buildings(name, address))')
    .eq('technician_id', technicianId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function listServiceRecordsByElevator(elevatorId: string): Promise<ServiceRecord[]> {
  const { data, error } = await supabase
    .from('service_records')
    .select('*')
    .eq('elevator_id', elevatorId)
    .order('service_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getServiceRecordById(id: string): Promise<ServiceRecord | null> {
  const { data, error } = await supabase
    .from('service_records')
    .select(`
      *,
      elevator:elevators(
        id,
        code,
        manufacturer,
        model,
        serial_number,
        operational_status,
        conservation_status,
        contractual_status,
        building:buildings(
          id,
          name,
          address,
          locality,
          client:clients(
            id,
            name
          )
        )
      ),
      technician:profiles(id, full_name, email),
      checklist:service_checklist_items(*),
      photos:service_photos(*)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createServiceRecord(record: Omit<ServiceRecord, 'id' | 'created_at' | 'updated_at' | 'status'>): Promise<ServiceRecord> {
  const { data, error } = await supabase
    .from('service_records')
    .insert({ ...record, status: 'draft' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateServiceRecord(id: string, updates: Partial<ServiceRecord>): Promise<ServiceRecord> {
  const { data, error } = await supabase
    .from('service_records')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function submitServiceRecord(id: string): Promise<ServiceRecord> {
  const { data, error } = await supabase
    .from('service_records')
    .update({
      status: 'submitted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteDraftServiceRecord(id: string): Promise<void> {
  const { error } = await supabase
    .from('service_records')
    .delete()
    .eq('id', id)
    .eq('status', 'draft');

  if (error) throw error;
}

// Checklist
export async function getChecklistByServiceRecord(serviceRecordId: string): Promise<ServiceChecklistItem[]> {
  const { data, error } = await supabase
    .from('service_checklist_items')
    .select('*')
    .eq('service_record_id', serviceRecordId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

export async function upsertChecklistItems(items: Omit<ServiceChecklistItem, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase
    .from('service_checklist_items')
    .upsert(items, { onConflict: 'id' });

  if (error) throw error;
}

export async function createChecklistItems(items: Omit<ServiceChecklistItem, 'id' | 'created_at'>[]): Promise<void> {
  const { error } = await supabase
    .from('service_checklist_items')
    .insert(items);

  if (error) throw error;
}

export async function deleteChecklistByServiceRecord(serviceRecordId: string): Promise<void> {
  const { error } = await supabase
    .from('service_checklist_items')
    .delete()
    .eq('service_record_id', serviceRecordId);

  if (error) throw error;
}

// Photos
export async function getPhotosByServiceRecord(serviceRecordId: string): Promise<ServicePhoto[]> {
  const { data, error } = await supabase
    .from('service_photos')
    .select('*')
    .eq('service_record_id', serviceRecordId)
    .order('created_at');

  if (error) throw error;
  return data || [];
}

export async function uploadServicePhoto(
  serviceRecordId: string,
  file: File,
  photoType: 'before' | 'after' | 'general' = 'general'
): Promise<ServicePhoto> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${serviceRecordId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('service-photos')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('service_photos')
    .insert({
      service_record_id: serviceRecordId,
      storage_path: fileName,
      photo_type: photoType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteServicePhoto(id: string): Promise<void> {
  const { data, error: fetchError } = await supabase
    .from('service_photos')
    .select('storage_path')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;

  if (data?.storage_path) {
    await supabase.storage
      .from('service-photos')
      .remove([data.storage_path]);
  }

  const { error } = await supabase
    .from('service_photos')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Search elevators for technician
export async function searchElevatorsForTechnician(query: string) {
  const { data, error } = await supabase
    .from('elevators')
    .select(`
      id,
      code,
      operational_status,
      conservation_status,
      contractual_status,
      manufacturer,
      model,
      serial_number,
      active,
      building:buildings(
        id,
        name,
        address,
        locality,
        client:clients(
          id,
          name
        )
      )
    `)
    .eq('active', true)
    .or(`code.ilike.%${query}%,serial_number.ilike.%${query}%,manufacturer.ilike.%${query}%,model.ilike.%${query}%`)
    .order('code')
    .limit(20);

  if (error) throw error;
  return data || [];
}
