/**
 * Email Options for sending emails
 */
export interface EmailOptions {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

/**
 * Email Attachment
 */
export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

/**
 * Email Provider Interface
 * All email providers must implement this interface
 */
export interface EmailProvider {
  /**
   * Send an email
   * @param options Email options
   */
  send(options: EmailOptions): Promise<void>;

  /**
   * Verify provider configuration
   */
  verify(): Promise<boolean>;
}

/**
 * Template Data for rendering email templates
 */
export interface TemplateData {
  [key: string]: unknown;
}

/**
 * Email Provider Type
 */
export enum EmailProviderType {
  SMTP = 'smtp',
  SENDGRID = 'sendgrid',
  RESEND = 'resend',
}

/**
 * Email Status for tracking
 */
export enum EmailStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Email Job Data
 */
export interface EmailJobData {
  templateName: string;
  to: string | string[];
  subject: string;
  data: TemplateData;
  priority?: number;
}

/**
 * Email Log Entry
 */
export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  provider: string;
  status: EmailStatus;
  attemptCount: number;
  errorMessage?: string;
  sentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
