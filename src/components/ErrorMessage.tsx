import type { ApiError } from "../api/client";

interface Props {
  error: ApiError | string | null | undefined;
  onRetry?: () => void;
}

export default function ErrorMessage({ error, onRetry }: Props) {
  if (!error) return null;
  const message = typeof error === "string" ? error : error.message;
  return (
    <div className="error" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="button button-quiet" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
