import chalk from 'chalk'
import { isEnvTest } from './const'

export default new chalk.Instance({ level: isEnvTest ? 0 : 1 })
