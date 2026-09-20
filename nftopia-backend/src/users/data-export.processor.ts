import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { GdprExportService } from './gdpr-export.service';
import { DATA_EXPORT_JOB, DATA_EXPORT_QUEUE } from './gdpr.constants';

interface DataExportJobPayload {
  jobId: string;
  userId: string;
  format: string;
}

/**
 * Bull worker that materializes asynchronous GDPR exports off the request
 * thread. Progress is persisted on the `data_export_jobs` row so clients can
 * poll `GET /users/export/jobs/:id`.
 */
@Processor(DATA_EXPORT_QUEUE)
export class DataExportProcessor {
  private readonly logger = new Logger(DataExportProcessor.name);

  constructor(private readonly exportService: GdprExportService) {}

  @Process(DATA_EXPORT_JOB)
  async handle(job: Job<DataExportJobPayload>): Promise<void> {
    this.logger.debug(`Processing data export job ${job.data.jobId}`);
    await this.exportService.processExportJob(job.data.jobId);
  }
}
