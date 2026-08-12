export const REBUILD_BATCH_SIZE = 500;
export const SYNC_STATE_ID = 1;
export const CONSOLE_CLEAR_SEQUENCE = "\x1b[2J\x1b[H";
export const STATUS_SEPARATOR = "==============================";
export const THREAD_REBUILD_SELECT = {
    externalId: true,
    inReplyTo: true,
    references: true,
} as const;
