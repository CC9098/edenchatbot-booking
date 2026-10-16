import { createHash } from 'node:crypto';
import { createServiceClient } from './supabase';
import { downloadNewsImage, EMPTY_NEWS, fetchIgMedia, type NewsSnapshot, type NewsSyncDependencies } from './ig-news-sync';

export function newsStore(): NewsSyncDependencies {
  const db = createServiceClient();
  return {
    async claim(runId, source, actor) {
      const { data, error } = await db.rpc('claim_ig_news_sync', { p_run_id: runId, p_source: source, p_actor: actor });
      if (error) throw new Error('Cannot start IG synchronization');
      return data === true;
    },
    async finish(runId, snapshot) {
      const { data, error } = await db.from('ig_news_sync').update({ items: snapshot.items, updated_at: snapshot.updatedAt, last_error: null, lease_until: null, run_id: null }).eq('id', 'eden').eq('run_id', runId).select('id');
      if (error || data?.length !== 1) throw new Error('Cannot save IG synchronization');
    },
    async fail(runId, message) {
      const { error } = await db.from('ig_news_sync').update({ last_error: message, lease_until: null, run_id: null }).eq('id', 'eden').eq('run_id', runId);
      if (error) throw new Error('Cannot record IG synchronization failure');
    },
    async read() {
      const { data, error } = await db.from('ig_news_sync').select('items,updated_at,attempted_at,last_error,source').eq('id', 'eden').maybeSingle();
      if (error) throw new Error('Cannot read IG synchronization');
      if (!data) return { ...EMPTY_NEWS };
      return { items: data.items, updatedAt: data.updated_at, attemptedAt: data.attempted_at, error: data.last_error, source: data.source } as NewsSnapshot;
    },
    fetchMedia: () => fetchIgMedia(process.env.EDEN_META_READ_TOKEN || ''),
    async cacheImage(item) {
      const { bytes, type } = await downloadNewsImage(item.img);
      const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
      const path = `${item.id}-${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
      const bucket = db.storage.from('ig-news');
      const { error } = await bucket.upload(path, bytes, { contentType: type, cacheControl: '31536000', upsert: true });
      if (error) throw new Error('Cannot save IG image');
      return bucket.getPublicUrl(path).data.publicUrl;
    },
  };
}
