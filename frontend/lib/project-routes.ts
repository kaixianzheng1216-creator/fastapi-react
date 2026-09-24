export const projectHref = (id: string) =>
  `/admin/projects/${encodeURIComponent(id)}/knowledge-bases`;

export const projectMembersHref = (id: string) =>
  `/admin/projects/${encodeURIComponent(id)}/members`;
