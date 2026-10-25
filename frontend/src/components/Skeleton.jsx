// Placeholder blocks shown while data loads, so the page layout is there immediately.
export function DetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading restaurant">
      <div className="skeleton" style={{ width: '7rem', height: '1rem', marginBottom: '0.8rem' }} />
      <div className="skeleton" style={{ height: '11rem', borderRadius: '18px', marginBottom: '1.25rem' }} />
      <div className="skeleton" style={{ width: '55%', height: '2.6rem', marginBottom: '0.6rem' }} />
      <div className="skeleton" style={{ width: '35%', height: '1rem', marginBottom: '1.5rem' }} />
      <div className="detail">
        <div className="skeleton" style={{ height: '18rem', borderRadius: '12px' }} />
        <div className="skeleton" style={{ height: '14rem', borderRadius: '12px' }} />
      </div>
    </div>
  );
}
