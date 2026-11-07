import type { es } from './es';

type Widen<T> = T extends string ? string : { [K in keyof T]: Widen<T[K]> };

/** Shape every locale must implement (derived from the Spanish reference). */
export type Messages = Widen<typeof es>;
