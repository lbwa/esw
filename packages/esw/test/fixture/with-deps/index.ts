import { createContext } from 'react'
import { of } from 'rxjs'
import { map } from 'rxjs/operators'
import { fib } from './src/dep'

const ConfigContext = createContext({ theme: 'light' })

export default ConfigContext

export const stream$ = of(1).pipe(map(fib))
