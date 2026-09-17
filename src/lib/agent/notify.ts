import type { Decision } from './decide';

/**
 * Outbound alerting for the evaluation agent.
 *
 * Posts to a single webhook URL in a shape Slack and Discord both render (`text` plus
 * a `content` alias), and includes the full structured payload so any other consumer
 * can parse rather than scrape. Silently no-ops when no webhook is configured — an
 * unrouted alert is not a failure, and must never fail the run that produced it.
 *
 * Spec: docs/AUTONOMOUS_EXPERIMENT_SERVICE.md §4.
 */

export interface AlertPayload {
  event:
    | 'EXPERIMENT_WINNER_PROMOTED'
    | 'EXPERIMENT_VARIANT_KILLED'
    | 'EXPERIMENT_PENDING_HUMAN_DECISION';
  title: string;
  experiment_id: string;
  experiment_name: string;
  decision: Decision;
  metrics: Record<string, unknown>;
  ai_diagnosis: string;
  action_taken: string;
  recommended_actions?: Array<{ label: string; action_url: string }>;
}

const EVENT_FOR: Record<Decision, AlertPayload['event'] | null> = {
  PROMOTE: 'EXPERIMENT_WINNER_PROMOTED',
  KILL: 'EXPERIMENT_VARIANT_KILLED',
  HUMAN_REVIEW: 'EXPERIMENT_PENDING_HUMAN_DECISION',
  // A test that is simply still running is not news. Alerting on every cron tick is
  // the fastest way to get the channel muted, which costs you the alerts that matter.
  CONTINUE: null,
};

const ICON: Record<Decision, string> = {
  PROMOTE: '🚀',
  KILL: '🔴',
  HUMAN_REVIEW: '⚖️',
  CONTINUE: '⏳',
};

export function alertEventFor(decision: Decision): AlertPayload['event'] | null {
  return EVENT_FOR[decision];
}

export function alertIconFor(decision: Decision): string {
  return ICON[decision];
}

function toMarkdown(payload: AlertPayload): string {
  const lines = [
    `${ICON[payload.decision]} *${payload.title}*`,
    `Experiment \`${payload.experiment_id}\` — ${payload.experiment_name}`,
    '',
    ...Object.entries(payload.metrics).map(([key, value]) => `• ${key}: ${value}`),
    '',
    payload.ai_diagnosis,
    '',
    `*Action:* ${payload.action_taken}`,
  ];

  if (payload.recommended_actions?.length) {
    lines.push('', ...payload.recommended_actions.map((a) => `→ <${a.action_url}|${a.label}>`));
  }

  return lines.join('\n');
}

/** Returns true when an alert was delivered, false when skipped or failed. */
export async function dispatchAlert(payload: AlertPayload): Promise<boolean> {
  const webhookUrl =
    process.env.GROWTH_ALERT_WEBHOOK_URL ?? import.meta.env.GROWTH_ALERT_WEBHOOK_URL;

  if (!webhookUrl) {
    console.info(`[agent:notify] No GROWTH_ALERT_WEBHOOK_URL — alert not sent: ${payload.title}`);
    return false;
  }

  try {
    const body = toMarkdown(payload);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` for Slack, `content` for Discord, `payload` for anything structured.
      body: JSON.stringify({ text: body, content: body, payload }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      console.error(`[agent:notify] webhook rejected with ${response.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      '[agent:notify] webhook failed:',
      error instanceof Error ? error.message : error
    );
    return false;
  }
}
