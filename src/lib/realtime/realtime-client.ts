import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import { api, BASE_URL } from "@/lib/api";

type EventHandler = (event: { data: string }) => void;

type Listeners = {
  onOpen?: () => void;
  onError?: () => void;
  onEvent?: Record<string, EventHandler>;
};

class FatalAuthError extends Error {}

class RealtimeClient {
  private controller: AbortController | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private token = "";
  private listeners: Listeners = {};
  private reconnectAttempts = 0;
  private stopped = true;

  setListeners(listeners: Listeners) {
    this.listeners = listeners;
  }

  start(token: string) {
    if (!token) {
      this.stop();
      return;
    }
    if (this.controller && this.token === token) return;
    this.teardown();
    this.token = token;
    this.stopped = false;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  reconnect() {
    if (this.stopped || !this.token) return;
    this.teardown();
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  stop() {
    this.stopped = true;
    this.teardown();
    this.token = "";
    this.reconnectAttempts = 0;
    this.listeners.onError?.();
  }

  private teardown() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.controller) {
      this.controller.abort();
      this.controller = null;
    }
  }

  private reconnectDelay() {
    const delay = Math.min(30_000, 1_000 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    return delay;
  }

  private scheduleReconnect() {
    if (this.stopped || !this.token || this.reconnectTimer) return;
    this.listeners.onError?.();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped && this.token && !this.controller) {
        this.openConnection();
      }
    }, this.reconnectDelay());
  }

  private openConnection() {
    const controller = new AbortController();
    this.controller = controller;
    const token = this.token;

    fetchEventSource(`${BASE_URL}/events`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
      openWhenHidden: true,

      onopen: async (response) => {
        const contentType = response.headers.get("content-type") ?? "";
        if (response.ok && contentType.includes(EventStreamContentType)) {
          this.reconnectAttempts = 0;
          this.listeners.onOpen?.();
          return;
        }
        if (response.status === 401 || response.status === 403) {
          // /auth/verify side-effect: api client runs its 401 -> redirect.
          api.get("/auth/verify").catch(() => {});
          throw new FatalAuthError();
        }
        throw new Error(`SSE connection failed (${response.status})`);
      },

      onmessage: (ev) => {
        if (!ev.event) return;
        this.listeners.onEvent?.[ev.event]?.({ data: ev.data });
      },

      // Throw so a clean server close routes to onerror and reconnects.
      onclose: () => {
        throw new Error("SSE stream closed");
      },

      onerror: (err) => {
        if (err instanceof FatalAuthError || this.stopped) throw err;
        this.listeners.onError?.();
        return this.reconnectDelay();
      },
    })
      .then(() => {
        // A live stream should not settle on its own. If it does, make sure
        // the client cannot remain stuck with a completed connection.
        if (this.controller !== controller) return;
        this.controller = null;
        this.scheduleReconnect();
      })
      .catch((err: unknown) => {
        if (this.controller !== controller) return;
        this.controller = null;
        if (!(err instanceof FatalAuthError)) this.scheduleReconnect();
      });
  }
}

export const realtimeClient = new RealtimeClient();
