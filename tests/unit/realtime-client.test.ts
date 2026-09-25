import type { FetchEventSourceInit } from "@microsoft/fetch-event-source";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@microsoft/fetch-event-source", () => ({
  EventStreamContentType: "text/event-stream",
  fetchEventSource: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  BASE_URL: "http://clinic.test/api",
  api: { get: vi.fn(() => Promise.resolve(undefined)) },
}));

// A fresh client per test: the module exports a single shared instance.
async function loadClient() {
  vi.resetModules();
  const sse = await import("@microsoft/fetch-event-source");
  const { api } = await import("@/lib/api");
  const { realtimeClient } = await import("@/lib/realtime/realtime-client");
  const fetchEventSource = vi.mocked(sse.fetchEventSource);
  // A live stream never settles on its own.
  fetchEventSource.mockImplementation(() => new Promise<void>(() => {}));
  const listeners = { onOpen: vi.fn(), onError: vi.fn(), onEvent: { notification: vi.fn() } };
  realtimeClient.setListeners(listeners);
  const connection = (index = 0) => fetchEventSource.mock.calls[index][1] as FetchEventSourceInit;
  return { realtimeClient, fetchEventSource, connection, listeners, api: vi.mocked(api) };
}

function eventStream(status = 200): Response {
  return new Response("", { status, headers: { "Content-Type": "text/event-stream" } });
}

async function rejectionOf(promise: Promise<unknown> | undefined): Promise<unknown> {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  return null;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("realtime client", () => {
  it("opens /events with the bearer token", async () => {
    const { realtimeClient, fetchEventSource, connection } = await loadClient();
    realtimeClient.start("tok-123");

    expect(fetchEventSource).toHaveBeenCalledTimes(1);
    expect(fetchEventSource.mock.calls[0][0]).toBe("http://clinic.test/api/events");
    expect(connection()).toMatchObject({
      method: "GET",
      headers: { Authorization: "Bearer tok-123" },
      openWhenHidden: true,
    });

    realtimeClient.start("tok-123");
    expect(fetchEventSource).toHaveBeenCalledTimes(1);
  });

  it("retries after 1 s, doubling up to 30 s", async () => {
    const { realtimeClient, connection, listeners } = await loadClient();
    realtimeClient.start("tok-123");

    const delays = Array.from({ length: 8 }, () => connection().onerror?.(new Error("dropped")));

    expect(delays).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect(listeners.onError).toHaveBeenCalledTimes(8);
  });

  it("starts over at 1 s once a stream opens", async () => {
    const { realtimeClient, connection, listeners } = await loadClient();
    realtimeClient.start("tok-123");
    connection().onerror?.(new Error("dropped"));
    connection().onerror?.(new Error("dropped"));

    await connection().onopen?.(eventStream());

    expect(listeners.onOpen).toHaveBeenCalledTimes(1);
    expect(connection().onerror?.(new Error("dropped"))).toBe(1000);
  });

  it("reconnects on the same schedule when a stream ends", async () => {
    const { realtimeClient, fetchEventSource } = await loadClient();
    vi.useFakeTimers();
    const ends: (() => void)[] = [];
    fetchEventSource.mockImplementation(
      () => new Promise<void>((resolve) => ends.push(resolve)),
    );
    realtimeClient.start("tok-123");

    ends[0]();
    await vi.advanceTimersByTimeAsync(999);
    expect(fetchEventSource).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchEventSource).toHaveBeenCalledTimes(2);

    ends[1]();
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchEventSource).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchEventSource).toHaveBeenCalledTimes(3);
  });

  it("stops retrying after an auth failure and lets the API client handle it", async () => {
    const { realtimeClient, connection, api } = await loadClient();
    realtimeClient.start("tok-123");

    const failure = await rejectionOf(connection().onopen?.(new Response("", { status: 401 })));

    expect(failure).toBeInstanceOf(Error);
    expect(api.get).toHaveBeenCalledWith("/auth/verify");
    expect(() => connection().onerror?.(failure)).toThrow();
  });

  it("treats other failed responses as retryable", async () => {
    const { realtimeClient, connection, api } = await loadClient();
    realtimeClient.start("tok-123");

    await expect(connection().onopen?.(new Response("", { status: 500 }))).rejects.toThrow(
      "SSE connection failed (500)",
    );
    expect(api.get).not.toHaveBeenCalled();
    expect(connection().onerror?.(new Error("SSE connection failed (500)"))).toBe(1000);
  });

  it("routes named events to their listeners", async () => {
    const { realtimeClient, connection, listeners } = await loadClient();
    realtimeClient.start("tok-123");

    connection().onmessage?.({ id: "", event: "notification", data: '{"id":"n1"}' });
    connection().onmessage?.({ id: "", event: "", data: "ignored" });

    expect(listeners.onEvent.notification).toHaveBeenCalledTimes(1);
    expect(listeners.onEvent.notification).toHaveBeenCalledWith({ data: '{"id":"n1"}' });
  });

  it("aborts the stream on stop", async () => {
    const { realtimeClient, connection, listeners } = await loadClient();
    realtimeClient.start("tok-123");
    const signal = connection().signal;

    realtimeClient.stop();

    expect(signal?.aborted).toBe(true);
    expect(listeners.onError).toHaveBeenCalledTimes(1);
  });
});
