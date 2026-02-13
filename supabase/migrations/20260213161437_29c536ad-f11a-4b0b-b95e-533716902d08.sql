
-- Active usernames table (unique usernames, track last seen)
CREATE TABLE public.active_usernames (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.active_usernames ENABLE ROW LEVEL SECURITY;

-- Anyone can read active usernames
CREATE POLICY "Anyone can view active usernames"
  ON public.active_usernames FOR SELECT USING (true);

-- Anyone can insert a username
CREATE POLICY "Anyone can claim a username"
  ON public.active_usernames FOR INSERT WITH CHECK (true);

-- Anyone can update their last_seen
CREATE POLICY "Anyone can update usernames"
  ON public.active_usernames FOR UPDATE USING (true);

-- Anyone can delete (for cleanup)
CREATE POLICY "Anyone can delete usernames"
  ON public.active_usernames FOR DELETE USING (true);

-- Chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  is_ai BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can read messages
CREATE POLICY "Anyone can view messages"
  ON public.chat_messages FOR SELECT USING (true);

-- Anyone can insert messages
CREATE POLICY "Anyone can send messages"
  ON public.chat_messages FOR INSERT WITH CHECK (true);

-- Anyone can delete expired messages
CREATE POLICY "Anyone can delete messages"
  ON public.chat_messages FOR DELETE USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- Cron extension for auto-delete
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Delete messages older than 10 minutes every minute
SELECT cron.schedule(
  'delete-old-messages',
  '* * * * *',
  $$DELETE FROM public.chat_messages WHERE created_at < now() - interval '10 minutes'$$
);

-- Delete inactive usernames (no activity for 15 minutes)
SELECT cron.schedule(
  'delete-inactive-usernames',
  '* * * * *',
  $$DELETE FROM public.active_usernames WHERE last_seen < now() - interval '15 minutes'$$
);
