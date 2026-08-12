import { OUTPUT_PATH } from "./exporter.constants.js";
import { mkdir, writeFile } from "node:fs/promises";
import { prisma } from "../db/client.js";
import { dirname } from "node:path";

const main = async () => {
  const messages = await prisma.message.findMany({
    select: {
      externalId: true,
      threadKey: true,
      parentId: true,
      sentAt: true,
      subject: true,
    },
    orderBy: {
      externalId: "asc",
    },
  });

  const content = messages
    .map((message) =>
      JSON.stringify({
        external_id: message.externalId,
        thread_key: message.threadKey ?? "",
        parent_id: message.parentId ?? "",
        sent_at: message.sentAt,
        subject: message.subject,
      }),
    )
    .join("\n");

  await mkdir(dirname(OUTPUT_PATH), {
    recursive: true,
  });

  await writeFile(
    OUTPUT_PATH,
    content.length > 0 ? `${content}\n` : "",
    "utf8",
  );

  console.log(
    `Exported ${messages.length} messages to ${OUTPUT_PATH}`,
  );
}

main()
  .catch((error) => {
    console.error("Exporter failed:");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
