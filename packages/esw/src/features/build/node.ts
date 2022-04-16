import { firstValueFrom } from 'rxjs'
import { EswBuildOptions } from './options'
import { AvailableCommands } from '@cli/constants'
import { createBundleService } from '@bundle/index'
import { dispatchInference } from '@inference/options'

export default function runBuild(
  options: EswBuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  return firstValueFrom(
    createBundleService(
      dispatchInference(options, AvailableCommands.Build, cwd)
    ).build(options?.clearBeforeBuild ?? false)
  )
}
