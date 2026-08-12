import { prisma } from "../db/client.js";
import fetchPage from "../provider/client.js";
import rebuildThreads from "./rebuild-threads.js";
import {
  CONSOLE_CLEAR_SEQUENCE,
  STATUS_SEPARATOR,
  SYNC_STATE_ID
} from "./worker.constants.js";

export const clearConsole = () => {
  process.stdout.write(CONSOLE_CLEAR_SEQUENCE);
}

const printStatus = (
  cursor: string | null,
  pagesFetched: number,
  received: number,
  inserted: number,
) => {
  clearConsole();

  console.log("Worker running");
  console.log(STATUS_SEPARATOR);
  console.log(`Last cursor:      ${cursor ?? "null"}`);
  console.log(`Pages fetched:    ${pagesFetched}`);
  console.log(`Received:         ${received}`);
  console.log(`Inserted:         ${inserted}`);
  console.log(STATUS_SEPARATOR);
}

const main = async () => {
  const state = await prisma.syncState.upsert({
    where: {
      id: SYNC_STATE_ID,
    },
    create: {
      id: SYNC_STATE_ID,
      cursor: null,
      finished: false,
    },
    update: {},
  });

  if (state.finished) {
    await rebuildThreads();
    return;
  }

  let cursor = state.cursor;
  let pagesFetched = 0;
  let received = 0;
  let inserted = 0;

  printStatus(cursor, pagesFetched, received, inserted);

  while (true) {
    const page = await fetchPage(cursor);

    pagesFetched++;
    received += page.items.length;

    const nextCursor = page.next_cursor;

    const result = await prisma.$transaction([
      prisma.message.createMany({
        data: page.items.map((message) => ({
          externalId: message.message_id,
          inReplyTo: message.in_reply_to ?? null,
          references: message.references ?? [],
          subject: message.subject,
          sentAt: message.sent_at,
        })),
        skipDuplicates: true,
      }),
      prisma.syncState.update({
        where: {
          id: SYNC_STATE_ID,
        },
        data: {
          cursor: nextCursor,
        },
      }),
    ]);

    inserted += result[0].count;
    cursor = nextCursor;

    printStatus(cursor, pagesFetched, received, inserted);

    if (nextCursor === null) {
      break;
    }
  }

  await prisma.syncState.update({
    where: {
      id: SYNC_STATE_ID,
    },
    data: {
      finished: true,
    },
  });
  await rebuildThreads();
}

main()
  .catch((error) => {
    console.error("Worker failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
