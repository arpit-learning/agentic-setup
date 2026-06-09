import { PostHog } from 'posthog-node';
import {
  getMachineId,
  getGitEmailInfo,
  getRepoHash,
  isTelemetryDisabled,
  wasNoticeShown,
  markNoticeShown,
} from './config.js';

const POSTHOG_KEY = 'phc_XXrV0pSX4s2QVxVoOaeuyXDvtlRwPAjovt1ttMGVMPp';

let client: PostHog | null = null;
let distinctId: string | null = null;
let superProperties: Record<string, unknown> = {};

export function initTelemetry(): void {
  if (isTelemetryDisabled()) return;

  const machineId = getMachineId();
  distinctId = machineId;

  client = new PostHog(POSTHOG_KEY, {
    host: 'https://us.i.posthog.com',
    flushAt: 20,
    flushInterval: 10000,
  });

  if (!wasNoticeShown()) {
    markNoticeShown();
  }

  const { hash: gitEmailHash, domain: emailDomain } = getGitEmailInfo();
  const repoHash = getRepoHash();

  superProperties = {
    ...(repoHash ? { repo_hash: repoHash } : {}),
    ...(emailDomain ? { email_domain: emailDomain } : {}),
  };

  client.identify({
    distinctId: machineId,
    properties: {
      ...(gitEmailHash ? { git_email_hash: gitEmailHash } : {}),
      ...(emailDomain ? { email_domain: emailDomain } : {}),
    },
  });
}

export function trackEvent(name: string, properties?: Record<string, unknown>): void {
  if (!client || !distinctId || isTelemetryDisabled()) return;
  client.capture({
    distinctId,
    event: name,
    properties: { ...superProperties, ...properties },
  });
}

let flushPromise: Promise<void> | null = null;

export async function flushTelemetry(): Promise<void> {
  if (!client) return;
  if (flushPromise) return flushPromise;
  const c = client;
  client = null;
  flushPromise = c.shutdown().catch(() => {});
  return flushPromise;
}
