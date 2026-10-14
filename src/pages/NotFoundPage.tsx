import { Link } from "react-router";

export default function NotFoundPage() {
  return (
    <div className="page">
      <h1 className="page-title">Page not found</h1>
      <p className="empty">
        That link doesn't go anywhere. <Link to="/teams">Go to your teams</Link>
      </p>
    </div>
  );
}
