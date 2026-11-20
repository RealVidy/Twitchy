import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SevenTvLiveUpdates } from '../src/content/live-updates';

class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: { op: number; d: { condition: { object_id: string } } }[] = [];
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  /** Server side: open the socket and say hello. */
  hello() {
    this.readyState = FakeSocket.OPEN;
    this.receive({ op: 1, d: { heartbeat_interval: 1000 } });
  }
  receive(msg: unknown) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
}

describe('SevenTvLiveUpdates', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const subs = (s: FakeSocket) => s.sent.map((m) => `${m.op}:${m.d.condition.object_id}`);

  it('subscribes after hello and forwards updates for the watched set', () => {
    const onUpdate = vi.fn();
    const live = new SevenTvLiveUpdates(onUpdate);
    live.watch('set-a');
    const ws = FakeSocket.instances[0];
    expect(ws.url).toBe('wss://events.7tv.io/v3');

    ws.hello();
    expect(subs(ws)).toEqual(['35:set-a']);

    ws.receive({ op: 0, d: { type: 'emote_set.update', body: { id: 'set-a', pushed: [] } } });
    ws.receive({ op: 0, d: { type: 'emote_set.update', body: { id: 'other', pushed: [] } } });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('moves the subscription when the channel changes', () => {
    const live = new SevenTvLiveUpdates(() => {});
    live.watch('set-a');
    const ws = FakeSocket.instances[0];
    ws.hello();
    live.watch('set-b');
    expect(subs(ws)).toEqual(['35:set-a', '36:set-a', '35:set-b']);
  });

  it('reconnects with backoff and subscribes again', () => {
    const live = new SevenTvLiveUpdates(() => {});
    live.watch('set-a');
    FakeSocket.instances[0].hello();
    FakeSocket.instances[0].close();

    vi.advanceTimersByTime(999);
    expect(FakeSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    const second = FakeSocket.instances[1];
    second.hello();
    expect(subs(second)).toEqual(['35:set-a']);
  });

  it('drops a connection that stops sending heartbeats', () => {
    const live = new SevenTvLiveUpdates(() => {});
    live.watch('set-a');
    const ws = FakeSocket.instances[0];
    ws.hello();
    vi.advanceTimersByTime(2000);
    expect(ws.readyState).toBe(3);
  });

  it('stops for good when watching nothing', () => {
    const live = new SevenTvLiveUpdates(() => {});
    live.watch('set-a');
    FakeSocket.instances[0].hello();
    live.watch(null);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.instances).toHaveLength(1);
  });
});
