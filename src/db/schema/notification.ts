import {
  boolean,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { organizations, users } from './core';
import { platform } from './integration';

/**
 * SYS-04 Notification & Communication Management.
 *
 * Template, kanal, pesan, penerima, log pengiriman, dan preferensi komunikasi.
 */
const createdAt = timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp('updated_at', { withTimezone: true })
  .defaultNow()
  .notNull()
  .$onUpdate(() => new Date());

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const notificationChannelTypeEnum = platform.enum('notification_channel_type', [
  'email',
  'sms',
  'whatsapp',
  'push',
  'in_app',
  'webhook',
]);

export const notificationTemplateStatusEnum = platform.enum('notification_template_status', [
  'draft',
  'active',
  'archived',
]);

export const notificationMessageStatusEnum = platform.enum('notification_message_status', [
  'queued',
  'scheduled',
  'processing',
  'sent',
  'failed',
  'cancelled',
]);

export const notificationRecipientStatusEnum = platform.enum('notification_recipient_status', [
  'pending',
  'sent',
  'delivered',
  'failed',
  'read',
]);

export const notificationDeliveryStatusEnum = platform.enum('notification_delivery_status', [
  'queued',
  'sent',
  'delivered',
  'failed',
  'bounced',
]);

/* ------------------------------------------------------------------ */
/* Channels & templates                                                */
/* ------------------------------------------------------------------ */

export const notificationChannels = platform.table(
  'notification_channels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 128 }).notNull(),
    type: notificationChannelTypeEnum('type').notNull(),
    provider: varchar('provider', { length: 128 }),
    description: text('description'),
    config: jsonb('config').$type<Record<string, unknown>>(),
    isActive: boolean('is_active').default(true).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('notification_channels_code_uq').on(t.code),
    index('notification_channels_type_idx').on(t.type),
  ],
);

export const notificationTemplates = platform.table(
  'notification_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    channelId: uuid('channel_id').references(() => notificationChannels.id, {
      onDelete: 'set null',
    }),
    channelType: notificationChannelTypeEnum('channel_type').default('email').notNull(),
    category: varchar('category', { length: 64 }).default('general').notNull(),
    locale: varchar('locale', { length: 16 }).default('id-ID').notNull(),
    subject: varchar('subject', { length: 255 }),
    body: text('body').notNull(),
    variables: jsonb('variables').$type<string[]>(),
    status: notificationTemplateStatusEnum('status').default('draft').notNull(),
    version: integer('version').default(1).notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('notification_templates_code_uq').on(t.code, t.locale),
    index('notification_templates_channel_idx').on(t.channelId),
    index('notification_templates_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Messages, recipients, delivery logs                                 */
/* ------------------------------------------------------------------ */

export const notificationMessages = platform.table(
  'notification_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageNumber: varchar('message_number', { length: 64 }).notNull(),
    templateId: uuid('template_id').references(() => notificationTemplates.id, {
      onDelete: 'set null',
    }),
    channelId: uuid('channel_id').references(() => notificationChannels.id, {
      onDelete: 'set null',
    }),
    channelType: notificationChannelTypeEnum('channel_type').default('email').notNull(),
    category: varchar('category', { length: 64 }).default('general').notNull(),
    subject: varchar('subject', { length: 255 }),
    body: text('body').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>(),
    status: notificationMessageStatusEnum('status').default('queued').notNull(),
    priority: integer('priority').default(0).notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('notification_messages_number_uq').on(t.messageNumber),
    index('notification_messages_status_idx').on(t.status),
    index('notification_messages_channel_idx').on(t.channelType),
    index('notification_messages_created_idx').on(t.createdAt),
  ],
);

export const notificationRecipients = platform.table(
  'notification_recipients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => notificationMessages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 32 }),
    status: notificationRecipientStatusEnum('status').default('pending').notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    errorMessage: text('error_message'),
    createdAt,
    updatedAt,
  },
  (t) => [
    index('notification_recipients_message_idx').on(t.messageId),
    index('notification_recipients_user_idx').on(t.userId),
    index('notification_recipients_status_idx').on(t.status),
  ],
);

export const notificationDeliveryLogs = platform.table(
  'notification_delivery_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => notificationMessages.id, { onDelete: 'cascade' }),
    recipientId: uuid('recipient_id').references(() => notificationRecipients.id, {
      onDelete: 'set null',
    }),
    channelType: notificationChannelTypeEnum('channel_type').notNull(),
    provider: varchar('provider', { length: 128 }),
    providerMessageId: varchar('provider_message_id', { length: 255 }),
    status: notificationDeliveryStatusEnum('status').default('queued').notNull(),
    response: jsonb('response').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt,
  },
  (t) => [
    index('notification_delivery_logs_message_idx').on(t.messageId),
    index('notification_delivery_logs_recipient_idx').on(t.recipientId),
    index('notification_delivery_logs_status_idx').on(t.status),
  ],
);

/* ------------------------------------------------------------------ */
/* Preferences                                                         */
/* ------------------------------------------------------------------ */

export const communicationPreferences = platform.table(
  'communication_preferences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    category: varchar('category', { length: 64 }).default('general').notNull(),
    channelType: notificationChannelTypeEnum('channel_type').notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    quietHoursStart: varchar('quiet_hours_start', { length: 5 }),
    quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
    updatedAt,
  },
  (t) => [
    uniqueIndex('communication_preferences_user_uq').on(t.userId, t.category, t.channelType),
    uniqueIndex('communication_preferences_org_uq').on(
      t.organizationId,
      t.category,
      t.channelType,
    ),
    index('communication_preferences_user_idx').on(t.userId),
  ],
);
