-- CreateTable
CREATE TABLE "Message" (
    "external_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "sent_at" TEXT NOT NULL,
    "in_reply_to" TEXT,
    "references" TEXT[],
    "thread_key" TEXT,
    "parent_id" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("external_id")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "cursor" TEXT,
    "finished" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);
