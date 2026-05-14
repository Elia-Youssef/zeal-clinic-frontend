import { api, BASE_URL } from "@/lib/api";

type EventHandler = (event: MessageEvent) => void;

type Listeners = {
  onOpen?: () => void;
  onError?: () => void;
  onEvent?: Record<string, EventHandler>;
};

class RealtimeClient {
  private source: EventSource | null = null;
  private token = "";
  private listeners: Listeners = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = true;

  setListeners(listeners: Listeners) {
    this.listeners = listeners;
  }

  start(token: string) {
    if (!token) {
      this.stop();
      return;
    }
    if (this.source && this.token === token) return;
    this.token = token;
    this.stopped = false;
    this.openConnection();
  }

  stop() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.source) {
      this.source.close();
      this.source = null;
    }
    this.token = "";
    this.reconnectAttempts = 0;
    this.listeners.onError?.();
  }

  private openConnection() {
    if (this.source) {
      this.source.close();
      this.source = null;
    }

    const url = `${BASE_URL}/events?access_token=${encodeURIComponent(this.token)}`;
    const source = new EventSource(url);
    this.source = source;

    source.onopen = () => {
      this.reconnectAttempts = 0;
      this.listeners.onOpen?.();
    };

    source.onerror = () => {
      this.listeners.onError?.();
      // CLOSED needs our reconnect path.
      if (source.readyState === EventSource.CLOSED) {
        source.close();
        if (this.source === source) this.source = null;
        // Probe auth because EventSource hides HTTP status.
        api.get("/auth/verify").catch(() => {});
        this.scheduleReconnect();
      }
    };

    if (this.listeners.onEvent) {
      for (const [name, handler] of Object.entries(this.listeners.onEvent)) {
        source.addEventListener(name, handler as EventListener);
      }
    }
  }

  private scheduleReconnect() {
    if (this.stopped) return;
    if (this.reconnectTimer) return;
    const delay = Math.min(
      30_000,
      1_000 * Math.pow(2, this.reconnectAttempts)
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.stopped || !this.token) return;
      this.openConnection();
    }, delay);
  }
}

export const realtimeClient = new RealtimeClient();
