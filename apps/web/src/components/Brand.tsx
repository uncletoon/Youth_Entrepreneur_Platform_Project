import { Link } from '../routing/router';

export const Brand = ({ light = false }: { light?: boolean }) => (
  <Link className={`brand ${light ? 'brand--light' : ''}`} to="/" aria-label="YERSPS home">
    <span className="brand__mark" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
    <span>
      YERSPS
      <small>Readiness to action</small>
    </span>
  </Link>
);
