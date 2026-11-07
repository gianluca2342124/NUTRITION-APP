import { brand } from '@repo/config';
import { Logo } from './logo';
import { t } from '@/lib/site';

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.2fr_2fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-[15px] text-muted">{t.web.footerTagline}</p>
        </div>
        <div className="space-y-3 text-[14px] leading-relaxed text-muted">
          <p className="font-semibold text-ink">{t.web.sourcesTitle}</p>
          <p>{t.web.sourcesBody}</p>
          <p>
            Datos de productos ©{' '}
            <a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href="https://world.openfoodfacts.org">
              Open Food Facts
            </a>
            , disponibles bajo la{' '}
            <a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href="https://opendatacommons.org/licenses/odbl/1-0/">
              Open Database License
            </a>
            . Alimentos genéricos:{' '}
            <a className="underline decoration-line-strong underline-offset-2 hover:text-ink" href="https://fdc.nal.usda.gov/">
              USDA FoodData Central
            </a>
            .
          </p>
          <p>{t.disclaimer.notMedical}</p>
          <p className="text-faint">© {brand.brandName}</p>
        </div>
      </div>
    </footer>
  );
}
