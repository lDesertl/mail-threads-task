import { clearConsole } from "./worker.js";
import { prisma } from "../db/client.js";
import {
    THREAD_REBUILD_SELECT,
    REBUILD_BATCH_SIZE,
    STATUS_SEPARATOR
} from "./worker.constants.js";

const getMessageLinks = (
    references: string[],
    inReplyTo: string | null,
) => {
    return [
        ...references,
        ...(inReplyTo !== null
            ? [inReplyTo]
            : []),
    ];
}

const printStatus = () => {
    clearConsole();

    console.log("Worker running");
    console.log(STATUS_SEPARATOR);
    console.log("Sync finished.");
    console.log("Rebuilding...");
    console.log(STATUS_SEPARATOR);

}
const rebuildThreads = async () => {

    printStatus();

    const messages = await prisma.message.findMany({
        select: THREAD_REBUILD_SELECT,
        orderBy: {
            externalId: "asc",
        },
    });

    if (messages.length === 0) {
        return;
    }

    const graph = new Map<string, Set<string>>();

    for (const message of messages) {
        graph.set(message.externalId, new Set());
    }

    for (const message of messages) {
        const links = getMessageLinks(
            message.references,
            message.inReplyTo,
        );

        const neighbours = graph.get(message.externalId)!;

        for (const linkedId of links) {
            const linkedNeighbours = graph.get(linkedId);

            if (!linkedNeighbours) {
                continue;
            }

            neighbours.add(linkedId);
            linkedNeighbours.add(message.externalId);
        }
    }

    const threadKeyByMessage = new Map<string, string>();
    const parentIdByMessage = new Map<string, string | null>();
    const visited = new Set<string>();

    for (const message of messages) {
        const startId = message.externalId;

        if (visited.has(startId)) {
            continue;
        }

        const component: string[] = [];
        const stack = [startId];

        visited.add(startId);

        while (stack.length > 0) {
            const currentId = stack.pop()!;
            component.push(currentId);

            for (const neighbourId of graph.get(currentId)!) {
                if (visited.has(neighbourId)) {
                    continue;
                }

                visited.add(neighbourId);
                stack.push(neighbourId);
            }
        }

        const threadKey = component.reduce((smallest, id) =>
            id < smallest ? id : smallest,
        );

        for (const messageId of component) {
            threadKeyByMessage.set(messageId, threadKey);
        }
    }

    for (const message of messages) {
        const links = getMessageLinks(
            message.references,
            message.inReplyTo,
        );

        let parentId: string | null = null;

        for (let i = links.length - 1; i >= 0; i--) {
            const candidate = links[i];

            if (candidate !== undefined && graph.has(candidate)) {
                parentId = candidate;
                break;
            }
        }

        parentIdByMessage.set(message.externalId, parentId);
    }

    for (let i = 0; i < messages.length; i += REBUILD_BATCH_SIZE) {
        const batch = messages.slice(i, i + REBUILD_BATCH_SIZE);

        await prisma.$transaction(
            batch.map((message) => {
                const threadKey = threadKeyByMessage.get(message.externalId);

                if (threadKey === undefined) {
                    throw new Error(
                        `Thread key was not calculated for ${message.externalId}`,
                    );
                }

                return prisma.message.update({
                    where: {
                        externalId: message.externalId,
                    },
                    data: {
                        threadKey,
                        parentId: parentIdByMessage.get(message.externalId) ?? null,
                    },
                });
            }),
        );
    }
}

export default rebuildThreads;
