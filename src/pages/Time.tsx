import { PageHeader } from '../components/PageHeader';
import { TimeReport } from '../components/TimeReport';

/** Every tracked entry, as in Clockify's tracker. */
export function Time() {
  return (
    <div>
      <PageHeader title="Time" />
      <TimeReport groupBy="project" />
    </div>
  );
}
