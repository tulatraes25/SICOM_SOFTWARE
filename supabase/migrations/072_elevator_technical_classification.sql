-- 072: Structured technical sheet for elevators
-- Additive only: no existing rows are updated or deleted.
-- The legacy elevators.elevator_type column is intentionally preserved.

ALTER TABLE public.elevators
  ADD COLUMN IF NOT EXISTS work_number TEXT,
  ADD COLUMN IF NOT EXISTS equipment_category TEXT,
  ADD COLUMN IF NOT EXISTS equipment_category_notes TEXT,
  ADD COLUMN IF NOT EXISTS stops_count INTEGER,
  ADD COLUMN IF NOT EXISTS door_type TEXT,
  ADD COLUMN IF NOT EXISTS door_opening_mm INTEGER,
  ADD COLUMN IF NOT EXISTS door_notes TEXT,
  ADD COLUMN IF NOT EXISTS operational_notes TEXT,
  ADD COLUMN IF NOT EXISTS motricity_type TEXT,
  ADD COLUMN IF NOT EXISTS traction_machine_manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS traction_machine_model TEXT,
  ADD COLUMN IF NOT EXISTS motor_power_hp NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS suspension_ratio TEXT,
  ADD COLUMN IF NOT EXISTS start_type TEXT,
  ADD COLUMN IF NOT EXISTS drive_controller TEXT,
  ADD COLUMN IF NOT EXISTS cable_count INTEGER,
  ADD COLUMN IF NOT EXISTS cable_length_m NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS hydraulic_resistance BOOLEAN,
  ADD COLUMN IF NOT EXISTS hydraulic_valve_block TEXT,
  ADD COLUMN IF NOT EXISTS hydraulic_piston TEXT,
  ADD COLUMN IF NOT EXISTS hydraulic_seal_number TEXT,
  ADD COLUMN IF NOT EXISTS control_system_brand TEXT,
  ADD COLUMN IF NOT EXISTS main_control_board TEXT,
  ADD COLUMN IF NOT EXISTS control_power_supply TEXT,
  ADD COLUMN IF NOT EXISTS control_optocoupler TEXT,
  ADD COLUMN IF NOT EXISTS emergency_rescue BOOLEAN,
  ADD COLUMN IF NOT EXISTS emergency_rescue_system TEXT,
  ADD COLUMN IF NOT EXISTS cabin_manufacturer TEXT,
  ADD COLUMN IF NOT EXISTS door_operator TEXT,
  ADD COLUMN IF NOT EXISTS safety_barrier TEXT,
  ADD COLUMN IF NOT EXISTS safety_barrier_status TEXT,
  ADD COLUMN IF NOT EXISTS cabin_access_notes TEXT,
  ADD COLUMN IF NOT EXISTS technical_notes TEXT,
  ADD COLUMN IF NOT EXISTS technical_data_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS technical_data_updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_equipment_category_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_equipment_category_check
      CHECK (equipment_category IS NULL OR equipment_category IN (
        'passenger_elevator',
        'freight_elevator',
        'passenger_freight_elevator',
        'stretcher_elevator',
        'vehicle_lift',
        'stairlift',
        'escalator',
        'other'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_motricity_type_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_motricity_type_check
      CHECK (motricity_type IS NULL OR motricity_type IN (
        'electromechanical', 'hydraulic', 'pneumatic', 'other'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_start_type_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_start_type_check
      CHECK (start_type IS NULL OR start_type IN (
        'direct', 'star_delta', 'softstarter', 'frequency_drive', 'other'
      ));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_stops_count_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_stops_count_check
      CHECK (stops_count IS NULL OR stops_count >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_door_opening_mm_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_door_opening_mm_check
      CHECK (door_opening_mm IS NULL OR door_opening_mm > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_motor_power_hp_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_motor_power_hp_check
      CHECK (motor_power_hp IS NULL OR motor_power_hp > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_cable_count_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_cable_count_check
      CHECK (cable_count IS NULL OR cable_count > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'elevators_cable_length_m_check') THEN
    ALTER TABLE public.elevators
      ADD CONSTRAINT elevators_cable_length_m_check
      CHECK (cable_length_m IS NULL OR cable_length_m > 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.mark_elevator_technical_data_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_changed BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_changed :=
      NEW.work_number IS NOT NULL OR
      NEW.equipment_category IS NOT NULL OR
      NEW.equipment_category_notes IS NOT NULL OR
      NEW.stops_count IS NOT NULL OR
      NEW.door_type IS NOT NULL OR
      NEW.door_opening_mm IS NOT NULL OR
      NEW.door_notes IS NOT NULL OR
      NEW.operational_notes IS NOT NULL OR
      NEW.motricity_type IS NOT NULL OR
      NEW.traction_machine_manufacturer IS NOT NULL OR
      NEW.traction_machine_model IS NOT NULL OR
      NEW.motor_power_hp IS NOT NULL OR
      NEW.suspension_ratio IS NOT NULL OR
      NEW.start_type IS NOT NULL OR
      NEW.drive_controller IS NOT NULL OR
      NEW.cable_count IS NOT NULL OR
      NEW.cable_length_m IS NOT NULL OR
      NEW.hydraulic_resistance IS NOT NULL OR
      NEW.hydraulic_valve_block IS NOT NULL OR
      NEW.hydraulic_piston IS NOT NULL OR
      NEW.hydraulic_seal_number IS NOT NULL OR
      NEW.control_system_brand IS NOT NULL OR
      NEW.main_control_board IS NOT NULL OR
      NEW.control_power_supply IS NOT NULL OR
      NEW.control_optocoupler IS NOT NULL OR
      NEW.emergency_rescue IS NOT NULL OR
      NEW.emergency_rescue_system IS NOT NULL OR
      NEW.cabin_manufacturer IS NOT NULL OR
      NEW.door_operator IS NOT NULL OR
      NEW.safety_barrier IS NOT NULL OR
      NEW.safety_barrier_status IS NOT NULL OR
      NEW.cabin_access_notes IS NOT NULL OR
      NEW.technical_notes IS NOT NULL;
  ELSE
    v_changed :=
      NEW.work_number IS DISTINCT FROM OLD.work_number OR
      NEW.equipment_category IS DISTINCT FROM OLD.equipment_category OR
      NEW.equipment_category_notes IS DISTINCT FROM OLD.equipment_category_notes OR
      NEW.stops_count IS DISTINCT FROM OLD.stops_count OR
      NEW.door_type IS DISTINCT FROM OLD.door_type OR
      NEW.door_opening_mm IS DISTINCT FROM OLD.door_opening_mm OR
      NEW.door_notes IS DISTINCT FROM OLD.door_notes OR
      NEW.operational_notes IS DISTINCT FROM OLD.operational_notes OR
      NEW.motricity_type IS DISTINCT FROM OLD.motricity_type OR
      NEW.traction_machine_manufacturer IS DISTINCT FROM OLD.traction_machine_manufacturer OR
      NEW.traction_machine_model IS DISTINCT FROM OLD.traction_machine_model OR
      NEW.motor_power_hp IS DISTINCT FROM OLD.motor_power_hp OR
      NEW.suspension_ratio IS DISTINCT FROM OLD.suspension_ratio OR
      NEW.start_type IS DISTINCT FROM OLD.start_type OR
      NEW.drive_controller IS DISTINCT FROM OLD.drive_controller OR
      NEW.cable_count IS DISTINCT FROM OLD.cable_count OR
      NEW.cable_length_m IS DISTINCT FROM OLD.cable_length_m OR
      NEW.hydraulic_resistance IS DISTINCT FROM OLD.hydraulic_resistance OR
      NEW.hydraulic_valve_block IS DISTINCT FROM OLD.hydraulic_valve_block OR
      NEW.hydraulic_piston IS DISTINCT FROM OLD.hydraulic_piston OR
      NEW.hydraulic_seal_number IS DISTINCT FROM OLD.hydraulic_seal_number OR
      NEW.control_system_brand IS DISTINCT FROM OLD.control_system_brand OR
      NEW.main_control_board IS DISTINCT FROM OLD.main_control_board OR
      NEW.control_power_supply IS DISTINCT FROM OLD.control_power_supply OR
      NEW.control_optocoupler IS DISTINCT FROM OLD.control_optocoupler OR
      NEW.emergency_rescue IS DISTINCT FROM OLD.emergency_rescue OR
      NEW.emergency_rescue_system IS DISTINCT FROM OLD.emergency_rescue_system OR
      NEW.cabin_manufacturer IS DISTINCT FROM OLD.cabin_manufacturer OR
      NEW.door_operator IS DISTINCT FROM OLD.door_operator OR
      NEW.safety_barrier IS DISTINCT FROM OLD.safety_barrier OR
      NEW.safety_barrier_status IS DISTINCT FROM OLD.safety_barrier_status OR
      NEW.cabin_access_notes IS DISTINCT FROM OLD.cabin_access_notes OR
      NEW.technical_notes IS DISTINCT FROM OLD.technical_notes;
  END IF;

  IF v_changed THEN
    NEW.technical_data_updated_at := NOW();
    NEW.technical_data_updated_by := auth.uid();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_elevator_technical_data_update ON public.elevators;
CREATE TRIGGER trg_mark_elevator_technical_data_update
BEFORE INSERT OR UPDATE ON public.elevators
FOR EACH ROW
EXECUTE FUNCTION public.mark_elevator_technical_data_update();

COMMENT ON COLUMN public.elevators.equipment_category IS
  'Functional equipment classification. Deliberately separate from legacy elevator_type.';
COMMENT ON COLUMN public.elevators.motricity_type IS
  'Technical motricity/traction classification.';
COMMENT ON COLUMN public.elevators.technical_data_updated_at IS
  'Last time one or more structured technical-sheet fields changed.';
