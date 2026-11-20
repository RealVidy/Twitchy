import type { EmoteSetUpdate } from '../emotes/seventv-updates';

const URL = 'wss://events.7tv.io/v3';

const OP = {
  dispatch: 0,
  hello: 1,
  heartbeat: 2,
  reconnect: 4,
  endOfStream: 7,
  subscribe: 35,
  unsubscribe: 36,
} as const;

const MIN_BACKOFF = 1_000;
const MAX_BACKOFF = 60_000;

interface Message {
  op: number;
  d?: { heartbeat_interval?: number; type?: string; body?: EmoteSetUpdate };
}

/**
 * Keeps one 7TV EventAPI connection open and listens to the current channel's emote set,
 * so emotes the streamer adds, removes or renames show up without a reload.
 */
export class SevenTvLiveUpdates {
  private ws: WebSocket | null = null;
  private setId: string | null = null;
  private backoff = MIN_BACKOFF;
  private reconnectTimer: number | undefined;
  private watchdog: number | undefined;
  private heartbeatMs = 45_000;

  constructor(private onUpdate: (update: EmoteSetUpdate) => void) {}

  /** Listens to `setId` instead of the previous set. Pass null to stop. */
  watch(setId: string | null): void {
    if (setId === this.setId) return;
    const previous = this.setId;
    this.setId = setId;

    if (!setId) return this.close();
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (previous) this.send(OP.unsubscribe, previous);
      this.send(OP.subscribe, setId);
    } else if (!this.ws) {
      this.connect();
    }
  }

  private connect(): void {
    window.clearTimeout(this.reconnectTimer);
    const ws = new WebSocket(URL);
    this.ws = ws;
    ws.onmessage = (e) => this.onMessage(JSON.parse(String(e.data)) as Message);
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.scheduleReconnect();
    };
  }

  private onMessage(msg: Message): void {
    switch (msg.op) {
      case OP.hello:
        this.backoff = MIN_BACKOFF;
        this.heartbeatMs = msg.d?.heartbeat_interval ?? this.heartbeatMs;
        if (this.setId) this.send(OP.subscribe, this.setId);
        break;
      case OP.dispatch:
        if (msg.d?.type === 'emote_set.update' && msg.d.body?.id === this.setId) {
          this.onUpdate(msg.d.body);
        }
        break;
      case OP.reconnect:
      case OP.endOfStream:
        this.ws?.close();
        return;
    }
    this.resetWatchdog();
  }

  private send(op: number, setId: string): void {
    this.ws?.send(
      JSON.stringify({ op, d: { type: 'emote_set.update', condition: { object_id: setId } } }),
    );
  }

  /** The server sends a heartbeat regularly; silence for two of them means the link is dead. */
  private resetWatchdog(): void {
    window.clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => this.ws?.close(), this.heartbeatMs * 2);
  }

  private scheduleReconnect(): void {
    window.clearTimeout(this.watchdog);
    if (!this.setId) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF);
    this.reconnectTimer = window.setTimeout(() => this.connect(), delay);
  }

  private close(): void {
    window.clearTimeout(this.reconnectTimer);
    window.clearTimeout(this.watchdog);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
