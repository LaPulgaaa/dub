import { DubApiError } from "@/lib/api/errors";
import { transformLink } from "@/lib/api/links";
import { getLinkOrThrow } from "@/lib/api/links/get-link-or-throw";
import { withWorkspace } from "@/lib/auth";
import { verifyFolderAccess } from "@/lib/folder/permissions";
import { getLinkInfoQuerySchemaExtended } from "@/lib/zod/schemas/links";
import { prisma } from "@dub/prisma";
import { NextResponse } from "next/server";

// GET /api/links/info – get the info for a link
export const GET = withWorkspace(
  async ({ headers, searchParams, workspace, session }) => {
    const queryParams = getLinkInfoQuerySchemaExtended.parse(searchParams);
    const { domain, key, linkId, externalId } = queryParams;

    if (!domain && !key && !linkId && !externalId) {
      throw new DubApiError({
        code: "bad_request",
        message:
          "You must provide a domain and a key or a linkId or an externalId to retrieve a link.",
        docUrl: "https://dub.co/docs/api-reference/endpoint/retrieve-a-link",
      });
    }

    const link = await getLinkOrThrow({
      ...queryParams,
      workspaceId: workspace.id,
    });

    if (link.folderId) {
      await verifyFolderAccess({
        workspace,
        userId: session.user.id,
        folderId: link.folderId,
        requiredPermission: "folders.read",
      });
    }

    const tags = await prisma.tag.findMany({
      where: {
        links: {
          some: {
            linkId: link.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        color: true,
      },
    });

    const response = transformLink(
      {
        ...link,
        tags: tags.map((tag) => {
          return { tag };
        }),
      },
      { skipDecodeKey: true },
    );

    return NextResponse.json(response, {
      headers,
    });
  },
  {
    requiredPermissions: ["links.read"],
  },
);
