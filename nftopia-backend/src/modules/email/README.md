# Email Module

Production-ready transactional email system for the NFTopia backend.

## Architecture

```
src/modules/email/
├── dto/                        # Request/validation DTOs
│   └── send-email.dto.ts
├── entities/                   # TypeORM entities
│   ├── email-log.entity.ts     # Email delivery tracking
│   ├── password-reset-token.entity.ts
│   └── verification-token.entity.ts
├── providers/                  # Email provider implementations
│   ├── smtp.provider.ts        # Nodemailer / SMTP
│   ├── sendgrid.provider.ts    # SendGrid API
│   └── resend.provider.ts      # Resend API
├── queue/                      # BullMQ queue
│   ├── email.processor.ts      # Job processor with retry
│   └── email.queue.service.ts  # Queue producer
├── templates/                  # Handlebars HTML templates
│   ├── verification.hbs
│   ├── password-reset.hbs
│   ├── bid-notification.hbs
│   └── auction-won.hbs
├── email.interface.ts          # Shared interfaces & enums
├── email.module.ts             # NestJS module
├── email.provider.ts           # Provider factory (DI token)
├── email.service.ts            # Core service
└── email-template.service.ts   # Handlebars renderer
```

## Configuration

Set `EMAIL_PROVIDER` to one of: `smtp` | `sendgrid` | `resend`

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM_ADDRESS=noreply@nftopia.com
EMAIL_FROM_NAME=NFTopia

# SMTP
SMTP_HOST=smtp.mailtrap.io
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...

# SendGrid
SENDGRID_API_KEY=SG.xxx
SENDGRID_FROM=noreply@nftopia.com

# Resend
RESEND_API_KEY=re_xxx
RESEND_FROM=noreply@nftopia.com
```

## Usage

```typescript
// Inject EmailService or EmailQueueService
constructor(
  private readonly emailService: EmailService,
  private readonly emailQueue: EmailQueueService,
) {}

// Direct (synchronous) send
await this.emailService.sendVerificationEmail(userId, email, username);
await this.emailService.requestPasswordReset(email, ipAddress);
await this.emailService.resetPassword(token, newPassword);

// Queued (async, with retry)
await this.emailQueue.queueBidNotificationEmail(to, username, nftName, ...);
await this.emailQueue.queueAuctionWonEmail(to, username, nftName, ...);
```

## Email Status Tracking

All emails are tracked in the `email_logs` table:

| Status      | Meaning                              |
|-------------|--------------------------------------|
| `pending`   | Job created, not yet processed       |
| `processing`| Processor picked up the job          |
| `sent`      | Provider confirmed delivery          |
| `failed`    | All retry attempts exhausted         |
| `retrying`  | Waiting for next retry attempt       |

## Retry Policy

Jobs use exponential backoff: 3 attempts, starting at 2 s delay.

Delay sequence: 2 s → 4 s → 8 s
