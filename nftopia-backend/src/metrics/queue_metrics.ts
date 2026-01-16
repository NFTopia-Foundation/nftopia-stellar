import client from 'prom-client';
import { paymentQueue } from '../queues/payment.queue';
import { notificationsQueue } from '../queues/notifications.queue';
import { onchainQueue } from '../queues/onchain.queue';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

const queueGauge = new client.Gauge({
  name: 'queue_jobs',
  help: 'Job counts per queue and status',
  labelNames: ['queue', 'status'],
});

register.registerMetric(queueGauge);

export async function updateQueueMetrics() {
  const [payment, notifications, onchain] = await Promise.all([
    paymentQueue.getJobCounts(),
    notificationsQueue.getJobCounts(),
    onchainQueue.getJobCounts(),
  ]);

  for (const [queueName, jobCounts] of Object.entries({
    payment,
    notifications,
    onchain,
  })) {
    for (const [status, count] of Object.entries(jobCounts)) {
      queueGauge.set({ queue: queueName, status }, count);
    }
  }
}

export default async function metricsHandler(req, res) {
  await updateQueueMetrics();
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
