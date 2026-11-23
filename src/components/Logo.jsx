import { Link } from 'react-router-dom';
import { APP_NAME } from '../lib/config.js';
import Icon from './Icon.jsx';

/** Flask mark plus the LabLink wordmark, linking home. */
export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 rounded-lg">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-maroon text-white shadow-sm">
        <Icon name="flask" className="h-5 w-5" />
      </span>
      <span className="wordmark text-xl text-maroon">
        LabLink
        <span className="sr-only"> ({APP_NAME} home)</span>
      </span>
    </Link>
  );
}
