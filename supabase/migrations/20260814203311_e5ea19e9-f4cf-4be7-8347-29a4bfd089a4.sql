CREATE TYPE public.app_role AS ENUM ('member','trainer');
CREATE TYPE public.booking_status AS ENUM ('pending','confirmed','cancelled','completed','no_show');
CREATE TYPE public.request_status AS ENUM ('pending','approved','rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  phone text,
  goal text,
  injuries text,
  preferred_time text,
  onboarded boolean NOT NULL DEFAULT false,
  suspended boolean NOT NULL DEFAULT false,
  trainer_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_my_member(_member_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _member_id AND trainer_id = auth.uid());
$$;

CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "trainer profiles visible" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(id, 'trainer'));
CREATE POLICY "trainer reads own members" ON public.profiles FOR SELECT TO authenticated USING (trainer_id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "trainer updates own members" ON public.profiles FOR UPDATE TO authenticated USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE POLICY "own roles read" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own role insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text,
  status public.request_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.join_requests TO authenticated;
GRANT ALL ON public.join_requests TO service_role;
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member manages own requests" ON public.join_requests FOR ALL TO authenticated USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
CREATE POLICY "trainer reads requests" ON public.join_requests FOR SELECT TO authenticated USING (trainer_id = auth.uid());
CREATE POLICY "trainer updates requests" ON public.join_requests FOR UPDATE TO authenticated USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE TABLE public.credit_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delta integer NOT NULL,
  kind text NOT NULL DEFAULT 'charge',
  amount_paid integer,
  note text,
  booking_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.credit_entries TO authenticated;
GRANT ALL ON public.credit_entries TO service_role;
ALTER TABLE public.credit_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member reads own credits" ON public.credit_entries FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "trainer reads member credits" ON public.credit_entries FOR SELECT TO authenticated USING (trainer_id = auth.uid() OR public.is_my_member(member_id));
CREATE POLICY "trainer inserts credits" ON public.credit_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'trainer') AND public.is_my_member(member_id));

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_at timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 50,
  status public.booking_status NOT NULL DEFAULT 'pending',
  cancel_requested boolean NOT NULL DEFAULT false,
  member_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member reads own bookings" ON public.bookings FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "member creates own bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (member_id = auth.uid());
CREATE POLICY "member updates own bookings" ON public.bookings FOR UPDATE TO authenticated USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
CREATE POLICY "trainer reads bookings" ON public.bookings FOR SELECT TO authenticated USING (trainer_id = auth.uid());
CREATE POLICY "trainer manages bookings" ON public.bookings FOR UPDATE TO authenticated USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "trainer creates bookings" ON public.bookings FOR INSERT TO authenticated WITH CHECK (trainer_id = auth.uid());

CREATE TABLE public.workout_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trainer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT (now()::date),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_logs TO authenticated;
GRANT ALL ON public.workout_logs TO service_role;
ALTER TABLE public.workout_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "member reads own logs" ON public.workout_logs FOR SELECT TO authenticated USING (member_id = auth.uid());
CREATE POLICY "trainer manages logs" ON public.workout_logs FOR ALL TO authenticated USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE TABLE public.workout_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.workout_logs(id) ON DELETE CASCADE,
  exercise text NOT NULL,
  weight_kg numeric,
  reps integer,
  sets integer,
  position integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_items TO authenticated;
GRANT ALL ON public.workout_items TO service_role;
ALTER TABLE public.workout_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read items of visible logs" ON public.workout_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.workout_logs l WHERE l.id = log_id AND (l.member_id = auth.uid() OR l.trainer_id = auth.uid())));
CREATE POLICY "trainer manages items" ON public.workout_items FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.workout_logs l WHERE l.id = log_id AND l.trainer_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.workout_logs l WHERE l.id = log_id AND l.trainer_id = auth.uid()));

CREATE TABLE public.trainer_settings (
  trainer_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  session_minutes integer NOT NULL DEFAULT 50,
  open_hour integer NOT NULL DEFAULT 8,
  close_hour integer NOT NULL DEFAULT 21,
  booking_cutoff_hours integer NOT NULL DEFAULT 3,
  cancel_cutoff_hours integer NOT NULL DEFAULT 12,
  closed_weekdays integer[] NOT NULL DEFAULT '{0}',
  holidays date[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.trainer_settings TO authenticated;
GRANT ALL ON public.trainer_settings TO service_role;
ALTER TABLE public.trainer_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings readable by authenticated" ON public.trainer_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "trainer manages settings" ON public.trainer_settings FOR INSERT TO authenticated WITH CHECK (trainer_id = auth.uid());
CREATE POLICY "trainer updates settings" ON public.trainer_settings FOR UPDATE TO authenticated USING (trainer_id = auth.uid()) WITH CHECK (trainer_id = auth.uid());

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications" ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE INDEX bookings_member_idx ON public.bookings(member_id, start_at);
CREATE INDEX bookings_trainer_idx ON public.bookings(trainer_id, start_at);
CREATE INDEX credit_member_idx ON public.credit_entries(member_id, created_at);
CREATE INDEX logs_member_idx ON public.workout_logs(member_id, log_date);