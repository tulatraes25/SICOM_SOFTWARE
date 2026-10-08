import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  EQUIPMENT_CATEGORY_LABELS,
  MOTRICITY_TYPE_LABELS,
  START_TYPE_LABELS,
} from '@/types/elevators';

const migration = readFileSync(
  resolve(__dirname, '../../supabase/migrations/072_elevator_technical_classification.sql'),
  'utf-8'
);
const form = readFileSync(resolve(__dirname, '../pages/admin/ElevatorForm.tsx'), 'utf-8');
const sheet = readFileSync(resolve(__dirname, '../components/elevators/ElevatorTechnicalSheet.tsx'), 'utf-8');
const publicService = readFileSync(resolve(__dirname, '../services/publicElevator.service.ts'), 'utf-8');
const publicView = readFileSync(resolve(__dirname, '../pages/public/PublicElevatorView.tsx'), 'utf-8');

describe('Ficha técnica de ascensores — taxonomía', () => {
  it('define categorías funcionales solicitadas sin campo especial de montavehículo', () => {
    expect(EQUIPMENT_CATEGORY_LABELS.passenger_elevator).toBe('Ascensor de pasajeros');
    expect(EQUIPMENT_CATEGORY_LABELS.freight_elevator).toBe('Montacargas');
    expect(EQUIPMENT_CATEGORY_LABELS.passenger_freight_elevator).toBe('Ascensor montacargas');
    expect(EQUIPMENT_CATEGORY_LABELS.stretcher_elevator).toBe('Ascensor camillero');
    expect(EQUIPMENT_CATEGORY_LABELS.vehicle_lift).toBe('Montavehículo');
    expect(EQUIPMENT_CATEGORY_LABELS.stairlift).toBe('Salvaescaleras');
    expect(EQUIPMENT_CATEGORY_LABELS.escalator).toBe('Escalera mecánica');

    const combined = `${migration}\n${form}\n${sheet}`.toLowerCase();
    expect(combined).not.toContain('cuando es montavehiculo');
    expect(combined).not.toContain('cuando es montavehículo');
  });

  it('separa motricidad y tipo de arranque', () => {
    expect(MOTRICITY_TYPE_LABELS.electromechanical).toBe('Electromecánico');
    expect(MOTRICITY_TYPE_LABELS.hydraulic).toBe('Hidráulico');
    expect(MOTRICITY_TYPE_LABELS.pneumatic).toBe('Neumático');
    expect(START_TYPE_LABELS.direct).toBe('Directo');
    expect(START_TYPE_LABELS.frequency_drive).toBe('Variador de frecuencia');
  });
});

describe('Migration 072 — esquema aditivo', () => {
  it('agrega campos técnicos sin modificar datos existentes', () => {
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS work_number TEXT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS equipment_category TEXT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS motricity_type TEXT');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS technical_data_updated_at TIMESTAMPTZ');
    expect(migration).toContain('ADD COLUMN IF NOT EXISTS technical_data_updated_by UUID');
    expect(migration).not.toMatch(/\bDELETE\s+FROM\s+public\.elevators/i);
    expect(migration).not.toMatch(/\bTRUNCATE\s+.*elevators/i);
    expect(migration).not.toMatch(/\bUPDATE\s+public\.elevators\b/i);
  });

  it('preserva elevator_type y valida solo la nueva taxonomía', () => {
    expect(migration).not.toMatch(/DROP\s+COLUMN\s+.*elevator_type/i);
    expect(migration).toContain("'vehicle_lift'");
    expect(migration).toContain("'hydraulic'");
    expect(migration).toContain("'frequency_drive'");
  });

  it('marca actualización técnica sin exigir datos obligatorios', () => {
    expect(migration).toContain('mark_elevator_technical_data_update');
    expect(migration).toContain('technical_data_updated_at := NOW()');
    expect(migration).toContain('technical_data_updated_by := auth.uid()');
    expect(migration).not.toMatch(/ALTER\s+COLUMN\s+\w+\s+SET\s+NOT\s+NULL/i);
  });
});

describe('Formulario de ficha técnica', () => {
  it('reutiliza campos existentes y no duplica puerta/apertura', () => {
    expect(form).toContain('serial_number');
    expect(form).toContain('manufacturer');
    expect(form).toContain('model');
    expect(form).toContain('capacity_kg');
    expect(form).toContain('floors_served');
    expect(form).toContain('year_installed');

    expect((form.match(/label="Tipo de puerta"/g) || [])).toHaveLength(1);
    expect((form.match(/label="Apertura de puerta \(mm\)"/g) || [])).toHaveLength(1);
  });

  it('muestra campos específicos según motricidad sin limpiar valores automáticamente', () => {
    expect(form).toContain("formData.motricity_type === 'electromechanical'");
    expect(form).toContain("formData.motricity_type === 'hydraulic'");
    expect(form).toContain('cable_count');
    expect(form).toContain('hydraulic_valve_block');
    expect(form).not.toMatch(/motricity_type.*setFormData[\s\S]{0,200}(cable_count|hydraulic_valve_block):\s*''/);
  });

  it('incluye número de obra y observaciones operativas', () => {
    expect(form).toContain('Número de Obra');
    expect(form).toContain('Observaciones del estado operativo');
    expect(form).toContain('technical_notes');
  });
});

describe('Privacidad del QR público', () => {
  const privateFields = [
    'work_number',
    'motor_power_hp',
    'hydraulic_valve_block',
    'hydraulic_piston',
    'hydraulic_seal_number',
    'main_control_board',
    'control_power_supply',
    'control_optocoupler',
    'cable_count',
    'cable_length_m',
    'technical_notes',
    'operational_notes',
  ];

  it('el servicio público no solicita ni devuelve campos técnicos internos', () => {
    for (const field of privateFields) {
      expect(publicService).not.toContain(field);
    }
  });

  it('la vista pública no representa campos técnicos internos', () => {
    for (const field of privateFields) {
      expect(publicView).not.toContain(field);
    }
  });
});
