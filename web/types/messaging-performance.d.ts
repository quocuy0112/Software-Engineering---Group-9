declare module "*/measure-messaging-performance.mjs" {
  export function measureMessagingPerformance(input?: { samples?: number }): Promise<{
    environment: {
      mode: string;
      node: string;
      conversations: number;
      messages: number;
      samples: number;
      concurrency: number;
    };
    conversationList: { samples: number; p50Ms: number; p95Ms: number; maxMs: number; errorRate: number };
    messageHistory: { samples: number; p50Ms: number; p95Ms: number; maxMs: number; errorRate: number };
    acceptedToPeerVisible: { samples: number; p50Ms: number; p95Ms: number; maxMs: number; errorRate: number };
  }>;
}
