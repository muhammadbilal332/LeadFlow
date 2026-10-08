/**
 * Who may read a prospect's replies. Replies are private to the salesperson the
 * lead is assigned to, plus the owner. Managers and other sales users only see
 * replies on leads assigned to them, so a manager with no assigned leads sees
 * none.
 */
export interface ReplyViewer {
  userId: string;
  role: string;
}

/** The assignee filter to apply to reply queries: none for owners, the viewer's own id for everyone else. */
export function replyScopeFor(viewer: ReplyViewer): string | undefined {
  return viewer.role === 'owner' ? undefined : viewer.userId;
}

export function canReadLeadReplies(viewer: ReplyViewer, leadAssigneeId: string | null | undefined): boolean {
  return viewer.role === 'owner' || (leadAssigneeId !== null && leadAssigneeId !== undefined && leadAssigneeId === viewer.userId);
}
