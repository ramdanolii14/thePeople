CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    actor_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id INTEGER REFERENCES public.posts(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('like', 'comment')),
    dedupe_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS notifications_recipient_created_idx
  ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
