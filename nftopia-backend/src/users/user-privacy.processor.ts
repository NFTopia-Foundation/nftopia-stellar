import { Injectable, Logger } from '@nestjs/common';
import { Process, Processor } from '@nestjs/bull';
import type { Job } from 'bull';
import { UsersService } from './users.service';
import {
  BUILD_USER_EXPORT_JOB,
  FINALIZE_ACCOUNT_DELETION_JOB,
  USER_PRIVACY_QUEUE,
  type BuildUserExportJob,
  type FinalizeAccountDeletionJob,
} from './privacy-jobs';

@Injectable()
@Processor(USER_PRIVACY_QUEUE)
export class UserPrivacyProcessor {
  private readonly logger = new Logger(UserPrivacyProcessor.name);

  constructor(private readonly usersService: UsersService) {}

  @Process(FINALIZE_ACCOUNT_DELETION_JOB)
  async finalizeDeletion(job: Job<FinalizeAccountDeletionJob>): Promise<void> {
    await this.usersService.finalizeAccountDeletion(
      job.data.userId,
      job.data.requestedAt,
    );
  }

  @Process(BUILD_USER_EXPORT_JOB)
  async buildExport(job: Job<BuildUserExportJob>) {
    try {
      return await this.usersService.prepareExportFile(
        job.data.userId,
        job.data.format,
      );
    } catch (error) {
      this.logger.error(
        `GDPR export job failed for user ${job.data.userId}: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
