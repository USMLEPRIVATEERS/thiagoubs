-- =============================================
-- Schema: UBS Sitio dos Remedios - Indicadores de Saude
-- Execute este SQL no Supabase SQL Editor
-- =============================================

-- Tabela: patients
CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  age_years INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM age(CURRENT_DATE, date_of_birth))::INTEGER) STORED,
  sex TEXT CHECK (sex IN ('M', 'F')),
  gender_identity TEXT,
  cpf TEXT UNIQUE,
  cns TEXT,
  micro_area INTEGER,
  team_type INTEGER CHECK (team_type IN (70, 76)) DEFAULT 70,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'moved', 'deceased')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: conditions
CREATE TABLE IF NOT EXISTS conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  code_system TEXT CHECK (code_system IN ('CID10', 'CIAP2')),
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  diagnosed_date DATE,
  resolved_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: consultations
CREATE TABLE IF NOT EXISTS consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  professional_type TEXT NOT NULL,
  professional_cbo TEXT,
  consultation_date DATE NOT NULL,
  modality TEXT CHECK (modality IN ('presencial', 'remota', 'domiciliar')),
  demand_type TEXT CHECK (demand_type IN ('programada', 'espontanea')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: measurements
CREATE TABLE IF NOT EXISTS measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  weight_kg NUMERIC(5,2),
  height_cm NUMERIC(5,1),
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  professional_cbo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: procedures
CREATE TABLE IF NOT EXISTS procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  procedure_code TEXT NOT NULL,
  procedure_name TEXT,
  procedure_date DATE NOT NULL,
  result_value TEXT,
  professional_cbo TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: home_visits
CREATE TABLE IF NOT EXISTS home_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  visitor_cbo TEXT NOT NULL,
  visit_date DATE NOT NULL,
  visit_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: vaccinations
CREATE TABLE IF NOT EXISTS vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  vaccine_code TEXT NOT NULL,
  vaccine_name TEXT,
  dose_date DATE NOT NULL,
  dose_number INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: pregnancies
CREATE TABLE IF NOT EXISTS pregnancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  dum DATE,
  dpp DATE,
  delivery_date DATE,
  outcome TEXT CHECK (outcome IN ('em_andamento', 'parto', 'aborto')),
  first_prenatal_date DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela: indicator_scores
CREATE TABLE IF NOT EXISTS indicator_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  indicator TEXT NOT NULL CHECK (indicator IN ('C1','C2','C3','C4','C5','C6','C7')),
  total_score NUMERIC(5,2) DEFAULT 0,
  max_possible_score NUMERIC(5,2) DEFAULT 100,
  breakdown JSONB,
  last_calculated TIMESTAMPTZ DEFAULT now(),
  UNIQUE(patient_id, indicator)
);

-- Tabela: csv_imports
CREATE TABLE IF NOT EXISTS csv_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT,
  import_date TIMESTAMPTZ DEFAULT now(),
  indicator TEXT,
  rows_imported INTEGER,
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'error')),
  error_log TEXT
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_conditions_patient ON conditions(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
CREATE INDEX IF NOT EXISTS idx_consultations_date ON consultations(consultation_date);
CREATE INDEX IF NOT EXISTS idx_measurements_patient ON measurements(patient_id);
CREATE INDEX IF NOT EXISTS idx_measurements_date ON measurements(measurement_date);
CREATE INDEX IF NOT EXISTS idx_procedures_patient ON procedures(patient_id);
CREATE INDEX IF NOT EXISTS idx_procedures_date ON procedures(procedure_date);
CREATE INDEX IF NOT EXISTS idx_home_visits_patient ON home_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_home_visits_date ON home_visits(visit_date);
CREATE INDEX IF NOT EXISTS idx_vaccinations_patient ON vaccinations(patient_id);
CREATE INDEX IF NOT EXISTS idx_pregnancies_patient ON pregnancies(patient_id);
CREATE INDEX IF NOT EXISTS idx_patients_status ON patients(status);
CREATE INDEX IF NOT EXISTS idx_patients_micro_area ON patients(micro_area);
CREATE INDEX IF NOT EXISTS idx_indicator_scores_patient ON indicator_scores(patient_id);

-- RLS (Row Level Security)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedures ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE indicator_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE csv_imports ENABLE ROW LEVEL SECURITY;

-- Politicas RLS: usuarios autenticados tem acesso total
CREATE POLICY "Authenticated users full access" ON patients FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON conditions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON consultations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON measurements FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON procedures FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON home_visits FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON vaccinations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON pregnancies FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON indicator_scores FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON csv_imports FOR ALL USING (auth.role() = 'authenticated');
