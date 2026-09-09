import type {
  AssistantTransportCommand,
  AttachmentAdapter,
  CompleteAttachment,
  FileMessagePart,
  PendingAttachment,
  ThreadUserMessagePart,
} from "@assistant-ui/react";
import {
  filesCompleteFileUpload,
  filesCreateFileUpload,
  filesDeleteUnreferencedFile,
} from "@/lib/client";
import {
  CHAT_CONTENT_TYPES,
  getFileContentType,
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
  TEXT_CONTENT_TYPES,
} from "@/lib/file-types";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "sonner";

const FILE_UPLOAD_ACCEPT = CHAT_CONTENT_TYPES.join(",");

const MAX_TEXT_FILE_SIZE = 256 * 1024;
const FILE_REFERENCE_PREFIX = "file:";

function createAttachmentContent(
  fileId: string,
  filename: string,
  contentType: string,
): ThreadUserMessagePart[] {
  const reference = `${FILE_REFERENCE_PREFIX}${fileId}`;

  return contentType.startsWith("image/")
    ? [{ type: "image", image: reference, filename }]
    : [
        {
          type: "file",
          data: reference,
          mimeType: contentType,
          filename,
        },
      ];
}

export function createFileAttachmentTransport() {
  const composerAttachmentIds = new Set<string>();
  let pendingFiles: FileMessagePart[] = [];
  let inFlightFiles: FileMessagePart[] = [];
  let pendingUploadCount = 0;

  const attachmentAdapter: AttachmentAdapter = {
    accept: FILE_UPLOAD_ACCEPT,

    async *add({ file }) {
      const contentType = getFileContentType(file);

      if (!contentType || !CHAT_CONTENT_TYPES.includes(contentType)) {
        toast.error("附件类型不受支持");
        throw new Error("附件类型不受支持");
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error("单个附件不能超过 100MB");
        throw new Error("单个附件不能超过 100MB");
      }

      if (
        TEXT_CONTENT_TYPES.includes(contentType) &&
        file.size > MAX_TEXT_FILE_SIZE
      ) {
        toast.error("文本附件不能超过 256KB");
        throw new Error("文本附件不能超过 256KB");
      }

      if (composerAttachmentIds.size + pendingUploadCount >= MAX_FILE_COUNT) {
        toast.error(`单条消息最多添加 ${MAX_FILE_COUNT} 个附件`);
        throw new Error(`单条消息最多添加 ${MAX_FILE_COUNT} 个附件`);
      }

      const attachmentType = contentType.startsWith("image/")
        ? "image"
        : "document";

      pendingUploadCount += 1;

      let uploadId = "";

      try {
        const { data: upload } = await filesCreateFileUpload({
          body: {
            filename: file.name,
            contentType,
            size: file.size,
          },
          throwOnError: true,
        });

        uploadId = upload.id;

        yield {
          id: upload.id,
          type: attachmentType,
          name: file.name,
          contentType,
          file,
          status: { type: "running", reason: "uploading", progress: 0 },
        } satisfies PendingAttachment;

        const response = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: upload.uploadHeaders,
          body: file,
        });

        if (!response.ok) {
          throw new Error(`对象存储上传失败（${response.status}）`);
        }

        await filesCompleteFileUpload({
          path: { file_id: upload.id },
          throwOnError: true,
        });
      } catch (error) {
        pendingUploadCount -= 1;

        if (!uploadId) {
          toast.error(getApiErrorMessage(error, "附件添加失败，请重试"));
        }

        try {
          if (uploadId) {
            await filesDeleteUnreferencedFile({
              path: { file_id: uploadId },
              throwOnError: true,
            });
          }
        } catch (cleanupError) {
          console.error("清理未引用附件失败", cleanupError);
        }

        throw error;
      }

      pendingUploadCount -= 1;
      composerAttachmentIds.add(uploadId);

      yield {
        id: uploadId,
        type: attachmentType,
        name: file.name,
        contentType,
        file,
        status: { type: "requires-action", reason: "composer-send" },
        content: createAttachmentContent(uploadId, file.name, contentType),
      } satisfies PendingAttachment;
    },

    async send(attachment) {
      if (!attachment.content?.length) {
        throw new Error("附件尚未上传完成");
      }

      const file = attachment.content.find(
        (part): part is FileMessagePart => part.type === "file",
      );

      if (file) pendingFiles.push(file);

      composerAttachmentIds.delete(attachment.id);

      return {
        ...attachment,
        status: { type: "complete" },
        content: attachment.content,
      } satisfies CompleteAttachment;
    },

    async remove(attachment) {
      await filesDeleteUnreferencedFile({
        path: { file_id: attachment.id },
        throwOnError: true,
      });

      composerAttachmentIds.delete(attachment.id);
    },
  };

  const prepareCommands = (commands: AssistantTransportCommand[]) => {
    const messageCommands = commands.filter(
      (command) => command.type === "add-message",
    );

    if (messageCommands.length > 1) {
      throw new Error("每次只能发送一条用户消息");
    }

    if (pendingFiles.length === 0) return commands;

    const messageCommand = messageCommands[0];

    if (!messageCommand) {
      throw new Error("附件必须随一条用户消息发送");
    }

    inFlightFiles = pendingFiles;
    pendingFiles = [];

    return commands.map((command) => {
      if (command !== messageCommand) return command;

      return {
        ...command,
        message: {
          ...command.message,
          parts: [...command.message.parts, ...inFlightFiles],
        },
      };
    });
  };

  const getPendingMessageFiles = (): readonly FileMessagePart[] => [
    ...pendingFiles,
    ...inFlightFiles,
  ];

  const complete = () => {
    inFlightFiles = [];
  };

  const discard = () => {
    pendingFiles = [];
    inFlightFiles = [];
  };

  return {
    attachmentAdapter,
    getPendingMessageFiles,
    prepareCommands,
    complete,
    discard,
  };
}
