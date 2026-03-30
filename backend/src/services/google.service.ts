import { google } from 'googleapis';
import { User } from '../db/models/User';
import { GoogleEvent, GoogleMessage } from '../db/models/GoogleData';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_OAUTH_REDIRECT_URI
);

export class GoogleService {
  static getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ];

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  static async getTokensFromCode(code: string) {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  }

  static async saveTokens(userId: string, tokens: any) {
    const update: any = {
      'googleTokens.accessToken': tokens.access_token,
      'googleTokens.expiryDate': tokens.expiry_date,
    };
    if (tokens.refresh_token) {
      update['googleTokens.refreshToken'] = tokens.refresh_token;
    }
    await User.findByIdAndUpdate(userId, { $set: update });
  }

  static async getCalendarEvents(userId: string) {
    const user = await User.findById(userId);
    if (!user || !user.googleTokens?.accessToken) {
      throw new Error('User not authenticated with Google');
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken,
      expiry_date: user.googleTokens.expiryDate,
    });

    const calendar = google.calendar({ version: 'v3', auth: client });
    const res = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 20,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const items = res.data.items || [];
    
    // Sync to DB
    for (const item of items) {
      await GoogleEvent.findOneAndUpdate(
        { googleId: item.id, userId },
        {
          userId,
          googleId: item.id,
          summary: item.summary,
          description: item.description,
          start: item.start?.dateTime || item.start?.date,
          end: item.end?.dateTime || item.end?.date,
          htmlLink: item.htmlLink,
          status: item.status,
        },
        { upsert: true }
      );
    }

    return GoogleEvent.find({ userId }).sort({ start: 1 }).limit(20);
  }

  static async getGmailMessages(userId: string) {
    const user = await User.findById(userId);
    if (!user || !user.googleTokens?.accessToken) {
      throw new Error('User not authenticated with Google');
    }

    const client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_OAUTH_REDIRECT_URI
    );

    client.setCredentials({
      access_token: user.googleTokens.accessToken,
      refresh_token: user.googleTokens.refreshToken,
      expiry_date: user.googleTokens.expiryDate,
    });

    const gmail = google.gmail({ version: 'v1', auth: client });
    const res = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 10,
    });

    const messages = [];
    if (res.data.messages) {
      for (const msg of res.data.messages) {
        const fullMsg = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id!,
        });
        const headers = fullMsg.data.payload?.headers || [];
        const subject = headers.find((h: any) => h.name === 'Subject')?.value;
        const from = headers.find((h: any) => h.name === 'From')?.value;
        const date = headers.find((h: any) => h.name === 'Date')?.value;

        const stored = await GoogleMessage.findOneAndUpdate(
          { googleId: msg.id, userId },
          {
            userId,
            googleId: msg.id,
            threadId: fullMsg.data.threadId,
            snippet: fullMsg.data.snippet,
            subject,
            from,
            date: date ? new Date(date) : undefined,
          },
          { upsert: true, new: true }
        );
        messages.push(stored);
      }
    }

    return GoogleMessage.find({ userId }).sort({ date: -1 }).limit(20);
  }

  static async search(userId: string, query: string) {
    const q = new RegExp(query, 'i');
    const [events, messages] = await Promise.all([
      GoogleEvent.find({ userId, $or: [{ summary: q }, { description: q }] }).limit(10),
      GoogleMessage.find({ userId, $or: [{ subject: q }, { snippet: q }, { from: q }] }).limit(10),
    ]);
    
    return [
      ...events.map(e => ({ ...e.toObject(), type: 'calendar' })),
      ...messages.map(m => ({ ...m.toObject(), type: 'gmail' })),
    ];
  }
}
