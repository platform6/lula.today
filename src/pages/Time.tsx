import { PageHeader } from '../components/PageHeader';
import { TimerBar } from '../components/Timer';
import { TimeReport } from '../components/TimeReport';

/** The home page: every tracked entry, as in Clockify's tracker. */
export function Time() {
  return (
    <div>
      <PageHeader title="Time" />
      <TimerBar variant="inline" />
      <TimeReport groupBy="project" />
    </div>
  );
}
