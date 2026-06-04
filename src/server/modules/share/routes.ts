import { Router } from 'express';

const router = Router();

router.get('/share-target', (req, res) => {
  const { title = '', text = '', url = '' } = req.query as Record<string, string>;
  const params = new URLSearchParams();
  if (title) params.set('share_title', title);
  if (text) params.set('share_text', text);
  if (url) params.set('share_url', url);
  res.redirect(`/?${params.toString()}`);
});

export default router;
