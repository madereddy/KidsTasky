import { Router } from 'express';

const router = Router();

const getString = (v: unknown): string =>
  typeof v === 'string' ? v : Array.isArray(v) ? String(v[0] ?? '') : '';

router.get('/share-target', (req, res) => {
  const title = getString(req.query.title);
  const text  = getString(req.query.text);
  const url   = getString(req.query.url);
  const params = new URLSearchParams();
  if (title) params.set('share_title', title);
  if (text) params.set('share_text', text);
  if (url) params.set('share_url', url);
  res.redirect(`/?${params.toString()}`);
});

export default router;
