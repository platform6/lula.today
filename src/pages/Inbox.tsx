import { useProjects } from '../db/hooks';
import { ProjectBoard } from './Board';

export function Inbox() {
  const projects = useProjects();
  if (!projects) return null;
  const inbox = projects.find((p) => p.is_inbox);
  if (!inbox) return <p className="p-4 text-muted">Setting up your Inbox… this needs one sync while online.</p>;
  return <ProjectBoard projectId={inbox.id} />;
}
