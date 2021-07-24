import { Observable, of, map } from 'rxjs'

export function lazyRequireObs<M = unknown>(filepath: string): Observable<M> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return of(filepath).pipe(map(p => require(p)))
}
