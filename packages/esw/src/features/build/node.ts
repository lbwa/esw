import { BuildOptions } from 'esbuild'
import { firstValueFrom } from 'rxjs'
import { AvailableCommands } from '@cli/constants'
import { BundleService, createInference } from '@bundle/index'

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  return firstValueFrom(
    BundleService.new(
      createInference(options, AvailableCommands.Build, cwd)
    ).build(true)
  )
}
