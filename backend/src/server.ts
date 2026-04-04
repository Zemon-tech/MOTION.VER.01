import dotenv from "dotenv";
dotenv.config();

import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import jwt from "jsonwebtoken";
import { Page } from "./db/models/Page";
import { createApp } from "./app";
import { connectMongo } from "./db/connection";
import { canRead, canEdit } from "./services/perm.service";
import { setIO } from "./services/socketHub";
import { emitSubpageMetaToAncestors } from "./services/socketHub";
import RedisService from "./services/redis.service";

const PORT = Number(process.env.PORT || 4000);
const DBG = process.env.DEBUG_LOGS === "1";

async function main() {
  const app = createApp();
  const server = createServer(app);
  await connectMongo();
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Authorization", "Content-Type"],
    },
    transports: ["websocket", "polling"],
  });
  setIO(io);

  type SavedState = {
    title?: string;
    content?: any;
    coverImageUrl?: string | null;
    coverPosition?: number;
    icon?: string | null;
  };
  const saveTimers = new Map<string, NodeJS.Timeout>();
  const pendingState = new Map<string, SavedState>();
  // Track per-socket per-page permission context derived during join
  const joinContext = new Map<
    string,
    Map<string, { token?: string | null; canEdit: boolean }>
  >();
  // Simple rate limiter per socket for edit events
  const rateState = new Map<string, { windowStart: number; count: number }>();
  const RATE_LIMIT_WINDOW_MS = 5000;
  const RATE_LIMIT_MAX = 60;

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("unauthorized"));
    try {
      const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET || "dev_access_secret",
      ) as any;
      (socket as any).user = { userId: payload.userId };
      next();
    } catch {
      next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    if (DBG) console.log("socket connected", (socket as any).user);
    socket.on(
      "page.join",
      async ({ pageId, token }: { pageId: string; token?: string | null }) => {
        try {
          const userId = (socket as any).user?.userId as string | undefined;
          if (!pageId) return;
          const page = await Page.findById(pageId).lean();
          if (!page) return;
          const readable = canRead(userId || null, page, token);
          if (!readable) return;
          const editable = canEdit(userId || null, page, token);
          if (DBG) console.log("join room", pageId, { readable, editable });
          let sctx = joinContext.get(socket.id);
          if (!sctx) {
            sctx = new Map();
            joinContext.set(socket.id, sctx);
          }
          sctx.set(pageId, { token: token || null, canEdit: !!editable });
          socket.join(`page:${pageId}`);
        } catch (e) {
          if (DBG) console.log("join error", e);
        }
      },
    );

    socket.on(
      "page.edit",
      async ({
        pageId,
        title,
        content,
        coverImageUrl,
        coverPosition,
        icon,
      }: {
        pageId: string;
        title?: string;
        content?: any;
        coverImageUrl?: string | null;
        coverPosition?: number;
        icon?: string | null;
      }) => {
        if (DBG)
          console.log("page.edit", {
            pageId,
            hasTitle: title !== undefined,
            hasContent: content !== undefined,
          });
        // rate limit
        const now = Date.now();
        const rs = rateState.get(socket.id) || { windowStart: now, count: 0 };
        if (now - rs.windowStart > RATE_LIMIT_WINDOW_MS) {
          rs.windowStart = now;
          rs.count = 0;
        }
        rs.count += 1;
        rateState.set(socket.id, rs);
        if (rs.count > RATE_LIMIT_MAX) {
          if (DBG) console.log("rate limited page.edit for socket", socket.id);
          return;
        }
        // permission check
        try {
          const userId = (socket as any).user?.userId as string | undefined;
          const sctx = joinContext.get(socket.id)?.get(pageId) || null;
          let allowed = false;
          if (sctx) {
            allowed = sctx.canEdit;
          } else {
            const page = await Page.findById(pageId).lean();
            if (page) {
              allowed = canEdit(userId || null, page, null);
            }
          }
          if (!allowed) return;
        } catch {
          return;
        }
        const key = `page:${pageId}`;
        const prev = pendingState.get(pageId) || {};
        pendingState.set(pageId, {
          ...prev,
          ...(title !== undefined ? { title } : {}),
          ...(content !== undefined ? { content } : {}),
          ...(coverImageUrl !== undefined ? { coverImageUrl } : {}),
          ...(coverPosition !== undefined ? { coverPosition } : {}),
          ...(icon !== undefined ? { icon } : {}),
        });
        io.to(key).emit("page.updated", {
          pageId,
          title,
          content,
          coverImageUrl,
          coverPosition,
          icon,
        });

        if (saveTimers.has(pageId)) clearTimeout(saveTimers.get(pageId)!);
        saveTimers.set(
          pageId,
          setTimeout(async () => {
            try {
              const state = pendingState.get(pageId);
              pendingState.delete(pageId);
              if (!state) return;
              const page = await Page.findById(pageId);
              if (!page) return;
              if (state.title !== undefined) (page as any).title = state.title;
              if (state.content !== undefined)
                (page as any).content = state.content;
              if (state.coverImageUrl !== undefined)
                (page as any).coverImageUrl = state.coverImageUrl;
              if (state.coverPosition !== undefined)
                (page as any).coverPosition = state.coverPosition;
              if (state.icon !== undefined) (page as any).icon = state.icon;
              await page.save();
              await RedisService.cachePage({
                ...(page.toObject() as Record<string, unknown>),
                _id: String(page._id),
              });
              // If title or icon changed, broadcast to ancestor pages so embedded blocks update
              if (state.title !== undefined || state.icon !== undefined) {
                let targets = Array.isArray((page as any).ancestors)
                  ? (page as any).ancestors.map((a: any) => String(a))
                  : [];
                if (!targets.length && (page as any).parentId)
                  targets = [String((page as any).parentId)];
                if (targets.length)
                  emitSubpageMetaToAncestors(targets, {
                    pageId: String(page._id),
                    ...(state.title !== undefined
                      ? { title: state.title }
                      : {}),
                    ...(state.icon !== undefined ? { icon: state.icon } : {}),
                  });
              }
              if (DBG) console.log("autosaved page", pageId);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error("Autosave error", e);
            }
          }, 800),
        );
      },
    );
    socket.on("disconnect", (reason) => {
      if (DBG) console.log("socket disconnected", reason);
      joinContext.delete(socket.id);
    });
  });

  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", err);
  process.exit(1);
});
