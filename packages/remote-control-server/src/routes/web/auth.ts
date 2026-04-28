import { Hono } from "hono";
import { config } from "../../config";
import {
  storeAuthorizeWebUuid,
  storeBindSession,
  storeConsumeWebPairingToken,
  storeIsWebUuidAuthorized,
} from "../../store";
import { resolveExistingWebSessionId, toWebSessionId } from "../../services/session";

const app = new Hono();

/** POST /web/bind — Bind a session to a UUID (no-login auth) */
app.post("/bind", async (c) => {
  const body = await c.req.json();
  const sessionId = body.sessionId;
  // UUID can come from query param (api.js sends it in URL) or body
  const uuid = c.req.query("uuid") || body.uuid;

  if (!sessionId || !uuid) {
    return c.json({ error: "sessionId and uuid are required" }, 400);
  }
  if (config.requireWebPairing && !storeIsWebUuidAuthorized(uuid)) {
    return c.json({ error: { type: "pairing_required", message: "Pair this browser from the VIPER terminal first" } }, 403);
  }

  const resolvedSessionId = resolveExistingWebSessionId(sessionId);
  if (!resolvedSessionId) {
    return c.json({ error: "Session not found" }, 404);
  }

  storeBindSession(resolvedSessionId, uuid);
  return c.json({ ok: true, sessionId: toWebSessionId(resolvedSessionId) });
});

/** POST /web/pair — Authorize a browser UUID with a short-lived pairing token */
app.post("/pair", async (c) => {
  const body = await c.req.json();
  const token = body.token;
  const uuid = c.req.query("uuid") || body.uuid;

  if (!uuid) {
    return c.json({ error: { type: "bad_request", message: "uuid is required" } }, 400);
  }

  if (!config.requireWebPairing) {
    storeAuthorizeWebUuid(uuid);
    return c.json({ ok: true }, 200);
  }

  if (!token || !storeConsumeWebPairingToken(token, uuid)) {
    return c.json({ error: { type: "forbidden", message: "Invalid or expired pairing token" } }, 403);
  }

  return c.json({ ok: true }, 200);
});

export default app;
