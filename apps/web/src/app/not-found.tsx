import Link from 'next/link';
import { SearchForm } from '@/components/search-form';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 pt-24 text-center sm:px-6">
      <p className="text-[14px] font-bold uppercase tracking-wider text-primary-text">404</p>
      <h1 className="mt-3 text-[34px] font-extrabold tracking-tight text-ink">No encontramos esta página</h1>
      <p className="mt-3 text-[16px] text-muted">Puede que el enlace haya cambiado. Busca lo que necesitas:</p>
      <div className="mt-8">
        <SearchForm size="md" />
      </div>
      <Link href="/" className="mt-6 inline-block text-[15px] font-semibold text-primary-text hover:underline">
        Volver al inicio
      </Link>
    </div>
  );
}
