import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks/useUtils.js';
import { Eyebrow } from '../../components/ui.jsx';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');
  return (
    <div className="relative mx-auto max-w-[1280px] overflow-hidden px-4 pb-10 pt-20 md:px-8 md:pt-32">
      <p className="ghost-text" aria-hidden="true">
        404
      </p>
      <Eyebrow className="mt-6">Page not found</Eyebrow>
      <h1 className="page-title mt-5 max-w-2xl">We couldn&rsquo;t find that page</h1>
      <p className="mt-4 text-[18px] text-charcoal">The link may be old, or the page may have moved.</p>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
        <Link to="/workshops" className="btn btn-secondary">
          Browse workshops
        </Link>
      </div>
    </div>
  );
}
