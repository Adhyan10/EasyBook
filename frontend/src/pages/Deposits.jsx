import { Link, useParams } from 'react-router-dom';
import { EmptyState, ErrorBanner, Spinner } from '../components/Feedback.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLoad } from '../hooks/useLoad.js';
import { DEPOSIT_LABEL, formatDate, rupees } from '../lib/format.js';

const SUMMARY_CARDS = Object.freeze([
  ['pendingAdjustment', 'To adjust at billing'],
  ['adjusted', 'Adjusted'],
  ['forfeited', 'Kept (no-show / late cancel)'],
  ['refunded', 'Refunded'],
  ['refundFailed', 'Refund failed (needs attention)'],
]);

export default function Deposits() {
  const { id } = useParams();
  const { call } = useAuth();
  const { data, error, loading } = useLoad(() => call(`/restaurants/${id}/deposits`), [id]);

  return (
    <>
      <p><Link to={`/owner/restaurants/${id}/reservations`}>← Reservations</Link></p>
      <h1>Deposits</h1>
      <ErrorBanner error={error} />
      {loading && <Spinner />}
      {data && (
        <>
          <div className="stats">
            {SUMMARY_CARDS.map(([key, label]) => (
              <div className="card stat" key={key}>
                <strong>{rupees(data.summary[key])}</strong>
                <span className="muted">{label}</span>
              </div>
            ))}
          </div>
          {data.items.length === 0 && <EmptyState>No deposits yet.</EmptyState>}
          {data.items.length > 0 && (
            <table>
              <thead><tr><th>Date</th><th>Time</th><th>Guest</th><th>Amount</th><th>Status</th></tr></thead>
              <tbody>
                {data.items.map((payment) => (
                  <tr key={payment._id}>
                    <td>{payment.booking ? formatDate(payment.booking.date) : '—'}</td>
                    <td>{payment.booking?.slotStart ?? '—'}</td>
                    <td>{payment.booking?.diner?.name ?? 'Guest'}</td>
                    <td>{rupees(payment.amount)}</td>
                    <td>
                      <span className={`badge ${payment.status}`}>{DEPOSIT_LABEL[payment.status]}</span>
                      {payment.adjustedAt && ' adjusted'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </>
  );
}
