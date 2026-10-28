/** Drag payloads shared by the Inbox list (source) and realm drop targets. */
export type InboxDragData = { type: 'inbox-task'; id: string; title: string };
export type RealmDropData = { type: 'realm'; areaId: string; name: string };
