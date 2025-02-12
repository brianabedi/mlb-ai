// utils/followEventManager.ts

type FollowEventCallback = () => void;

class FollowEventManager {
  private static listeners: Set<FollowEventCallback> = new Set();

  static subscribe(callback: FollowEventCallback): () => void {
    this.listeners.add(callback);
    return () => this.unsubscribe(callback);
  }

  static unsubscribe(callback: FollowEventCallback): void {
    this.listeners.delete(callback);
  }

  static notify(): void {
    this.listeners.forEach(callback => callback());
  }
}

// Re-export event types
export type { FollowEventCallback };
export default FollowEventManager;