CREATE TABLE IF NOT EXISTS public.overseas_consultation_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new_submission' CHECK (
    status IN (
      'new_submission',
      'payment_proof_uploaded',
      'basic_fee_confirmed',
      'appointment_confirmed',
      'consultation_completed',
      'herbal_fee_quoted',
      'herbal_fee_paid',
      'dispensing_in_progress',
      'posted',
      'postage_reimbursement_pending',
      'completed'
    )
  ),
  basic_fee_status text NOT NULL DEFAULT 'uploaded' CHECK (
    basic_fee_status IN ('pending', 'uploaded', 'confirmed')
  ),
  basic_fee_amount integer NOT NULL DEFAULT 400,
  patient_chinese_name text NOT NULL,
  patient_english_name text,
  whatsapp text NOT NULL,
  email text NOT NULL,
  country text NOT NULL,
  city text NOT NULL,
  timezone text NOT NULL,
  preferred_date date NOT NULL,
  preferred_time text NOT NULL,
  alternate_times text,
  recipient_name text NOT NULL,
  recipient_phone text NOT NULL,
  address_line1 text NOT NULL,
  address_line2 text,
  shipping_city text NOT NULL,
  shipping_region text,
  postal_code text,
  shipping_country text NOT NULL,
  health_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  emergency_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  payment_payer_name text NOT NULL,
  payment_time text NOT NULL,
  payment_notes text,
  payment_proof_path text,
  payment_proof_name text,
  payment_proof_mime text,
  payment_proof_size integer,
  payment_proof_uploaded boolean NOT NULL DEFAULT false,
  consent_confirmations text[] NOT NULL DEFAULT ARRAY[]::text[],
  staff_notes text,
  suggested_herbal_days integer,
  quoted_herbal_fee integer,
  herbal_fee_paid boolean NOT NULL DEFAULT false,
  admin_fee_paid boolean NOT NULL DEFAULT false,
  dispensing_completed boolean NOT NULL DEFAULT false,
  actual_postage integer,
  tracking_number text,
  postage_reimbursed boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_overseas_consultation_submissions_created_at
  ON public.overseas_consultation_submissions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_overseas_consultation_submissions_status
  ON public.overseas_consultation_submissions(status);

ALTER TABLE public.overseas_consultation_submissions ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'overseas-consultation-proofs',
  'overseas-consultation-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
