import { FileLibraryDetail } from "@/app/admin/file-libraries/_components/base-detail";

export default async function FileLibraryDetailPage({
  params,
}: {
  params: Promise<{ fileLibraryId: string }>;
}) {
  const { fileLibraryId } = await params;

  return <FileLibraryDetail fileLibraryId={fileLibraryId} />;
}
