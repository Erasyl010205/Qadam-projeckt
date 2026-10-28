import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const pongRooms = sqliteTable('pong_rooms', {
  code: text('code').primaryKey(),
  version: integer('version').notNull().default(0),
  data: text('data').notNull(),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  creatorKey: text('creator_key').notNull(),
}, table => [index('pong_rooms_expiry').on(table.expiresAt), index('pong_rooms_creator').on(table.creatorKey, table.createdAt)]);
