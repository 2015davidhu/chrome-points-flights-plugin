import { useState } from 'react';
import { parseGarminEmail } from '../utils/garmin-email-parser';
import { saveWorkout } from '../utils/storage';

interface GarminImportProps {
  onImport: () => void;
}

export function GarminImport({ onImport }: GarminImportProps) {
  const [emailBody, setEmailBody] = useState('');
  const [lastResult, setLastResult] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleImport = () => {
    if (!emailBody.trim()) return;

    const data = parseGarminEmail(emailBody);
    let imported = 0;

    for (const workout of data.workouts) {
      saveWorkout(workout);
      imported++;
    }

    setLastResult(
      imported > 0
        ? `Imported ${imported} workout(s) from ${data.date}. Steps: ${data.steps}, Distance: ${data.totalDistance}km`
        : 'No workouts found in email. Try pasting the full email body.'
    );
    setEmailBody('');
    if (imported > 0) onImport();
  };

  return (
    <div className="garmin-import">
      <button className="garmin-toggle" onClick={() => setExpanded(!expanded)}>
        {expanded ? '▾' : '▸'} Import from Garmin Email
      </button>

      {expanded && (
        <div className="garmin-form">
          <p className="garmin-hint">
            Paste the body of a Garmin daily summary email to auto-import workouts.
          </p>
          <textarea
            value={emailBody}
            onChange={e => setEmailBody(e.target.value)}
            placeholder="Paste your Garmin daily summary email here..."
            rows={6}
          />
          <button onClick={handleImport}>Parse &amp; Import</button>
          {lastResult && <p className="garmin-result">{lastResult}</p>}
        </div>
      )}
    </div>
  );
}
