import { BuildOptions } from 'esbuild'
import { firstValueFrom } from 'rxjs'
import { AvailableCommands } from '@cli/constants'
import { createBundleService } from '@bundle/index'
import { dispatchInference } from '@inference/options'

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  return firstValueFrom(
    createBundleService(
      dispatchInference(options, AvailableCommands.Build, cwd)
    ).build(true)
  )
}
