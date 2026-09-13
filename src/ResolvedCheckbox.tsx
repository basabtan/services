import { isRequestResolved, type RequestStatus } from './requests';

export function ResolvedCheckbox({ status, onChange, disabled = false, testId }: {
  status: RequestStatus;
  onChange: (status: RequestStatus) => void;
  disabled?: boolean;
  testId: string;
}) {
  return (
    <label className={`cr-resolved${isRequestResolved({ status }) ? ' is-resolved' : ''}`}>
      <input type="checkbox" checked={isRequestResolved({ status })} disabled={disabled}
        onChange={event => onChange(event.target.checked ? 'Completed' : 'Requested')}
        data-testid={testId} />
      <span>
        <strong>Resolved</strong>
        <small>Mark this request complete so it can be cleared from the inbox.</small>
      </span>
    </label>
  );
}
