export const EMAIL_QUEUE_NAME = 'email';
export const SEND_EMAIL_JOB = 'send';

export type EmailJobType =
  | 'verification'
  | 'password_reset'
  | 'password_changed'
  | 'bid_notification'
  | 'auction_won';

/** Payload persisted on the Bull job — the EmailProcessor reads this to send + log. */
export interface EmailJobData {
  logId: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  type: EmailJobType;
}
