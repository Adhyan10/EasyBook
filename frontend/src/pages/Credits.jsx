import { Link } from 'react-router-dom';
import photos from '../data/coverPhotos.json';

const POOL_LABEL = {
  south: 'South Indian food',
  north: 'North Indian food',
  biryani: 'Biryani',
  chinese: 'Chinese and Asian food',
  cafe: 'Cafe food and drinks',
  interior: 'Restaurant interiors',
};

export default function Credits() {
  return (
    <>
      <Link to="/" className="back-link">← All restaurants</Link>
      <h1 className="page-title">Photo credits</h1>
      <p className="banner banner-warn">
        The photos on restaurant cards and pages are illustrative stock images. They are not pictures of the
        restaurants themselves.
      </p>
      <p className="muted">
        Photos come from <a href="https://commons.wikimedia.org">Wikimedia Commons</a> and are used under the
        licences below. Restaurant names and addresses come from{' '}
        <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL).
      </p>
      {Object.entries(photos.pools).map(([pool, list]) => (
        <section key={pool}>
          <h2 className="section-title">{POOL_LABEL[pool] ?? pool}</h2>
          <ul className="credits">
            {list.map((photo) => (
              <li key={photo.file} className="credit">
                <img src={`/covers/${photo.file}`} alt="" width="120" height="78" loading="lazy" />
                <div>
                  <a href={photo.source}>{photo.title}</a>
                  <div className="small muted">
                    {photo.author} ·{' '}
                    {photo.licenseUrl ? <a href={photo.licenseUrl}>{photo.license}</a> : photo.license}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
