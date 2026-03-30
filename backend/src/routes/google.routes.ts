import { Router } from 'express';
import { auth } from '../middleware/auth';
import { GoogleService } from '../services/google.service';

const router = Router();

// OAuth initiation
router.get('/auth/url', auth, (req: any, res) => {
  const url = GoogleService.getAuthUrl();
  res.json({ url });
});

// OAuth Callback
router.get('/auth/callback', async (req: any, res) => {
  const { code, state } = req.query; // 'state' can link back to userId if passed
  try {
    const tokens = await GoogleService.getTokensFromCode(code as string);
    // Ideally user ID is in state, but for simplicity we'll assume current logged in user
    // This is more complex if not using session/state
    res.redirect(`${process.env.CORS_ORIGIN}/google-auth-success?code=${code}`);
  } catch (err) {
    res.redirect(`${process.env.CORS_ORIGIN}/google-auth-error`);
  }
});

// Actually save tokens
router.post('/auth/tokens', auth, async (req: any, res, next) => {
  try {
    const { code } = req.body;
    const tokens = await GoogleService.getTokensFromCode(code);
    await GoogleService.saveTokens(req.user.userId, tokens);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Calendar events
router.get('/calendar/events', auth, async (req: any, res, next) => {
  try {
    const events = await GoogleService.getCalendarEvents(req.user.userId);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

// Gmail messages
router.get('/gmail/messages', auth, async (req: any, res, next) => {
  try {
    const messages = await GoogleService.getGmailMessages(req.user.userId);
    res.json({ messages });
  } catch (err) {
    next(err);
  }
});

// Combined search
router.get('/search', auth, async (req: any, res, next) => {
  const { q } = req.query;
  try {
    const [events, messages] = await Promise.all([
      GoogleService.getCalendarEvents(req.user.userId),
      GoogleService.getGmailMessages(req.user.userId)
    ]);
    const filteredEvents = events?.filter((e: any) => e.summary?.toLowerCase().includes(String(q).toLowerCase())) || [];
    const filteredMessages = messages?.filter((m: any) => m.snippet?.toLowerCase().includes(String(q).toLowerCase())) || [];
    res.json({ results: { events: filteredEvents, messages: filteredMessages } });
  } catch (err) {
    next(err);
  }
});

export default router;
