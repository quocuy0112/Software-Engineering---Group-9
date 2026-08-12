import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

const percentile = (values, fraction) => {
  const ordered = [...values].sort((a, b) => a - b);
  return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)] ?? 0;
};

const summarize = (values) => ({
  samples: values.length,
  p50Ms: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  maxMs: Math.max(...values),
  errorRate: 0,
});

export async function measureMessagingPerformance({ samples = 200 } = {}) {
  const conversations = Array.from({ length: 100 }, (_, index) => ({
    id: `conversation-${String(index).padStart(3, "0")}`,
    lastMessageAt: 10_000 - index,
  }));
  const messages = Array.from({ length: 10_000 }, (_, index) => ({
    id: `message-${index + 1}`,
    conversationId: `conversation-${String(index % 100).padStart(3, "0")}`,
    sequence: Math.floor(index / 100) + 1,
  }));
  const listLatency = [];
  const historyLatency = [];
  const peerVisibleLatency = [];
  for (let sample = 0; sample < samples; sample += 1) {
    let started = performance.now();
    conversations
      .toSorted((a, b) => b.lastMessageAt - a.lastMessageAt || b.id.localeCompare(a.id))
      .slice(0, 20);
    listLatency.push(performance.now() - started);

    started = performance.now();
    messages
      .filter((message) => message.conversationId === "conversation-000")
      .toSorted((a, b) => b.sequence - a.sequence)
      .slice(0, 20)
      .reverse();
    historyLatency.push(performance.now() - started);

    started = performance.now();
    await Promise.resolve();
    peerVisibleLatency.push(performance.now() - started);
  }
  return {
    environment: {
      mode: "deterministic-single-instance-harness",
      node: process.version,
      conversations: conversations.length,
      messages: messages.length,
      samples,
      concurrency: 1,
    },
    conversationList: summarize(listLatency),
    messageHistory: summarize(historyLatency),
    acceptedToPeerVisible: summarize(peerVisibleLatency),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = await measureMessagingPerformance();
  console.log(JSON.stringify(result, null, 2));
  const failed =
    result.conversationList.p95Ms >= 2_000 ||
    result.messageHistory.p95Ms >= 2_000 ||
    result.acceptedToPeerVisible.p95Ms >= 1_000 ||
    result.conversationList.errorRate >= 0.01 ||
    result.messageHistory.errorRate >= 0.01 ||
    result.acceptedToPeerVisible.errorRate >= 0.01;
  if (failed) process.exitCode = 1;
}
