import { BuildOptions } from 'esbuild'
import { firstValueFrom } from 'rxjs'
import { AvailableCommands } from '../../cli/constants'
import { BundleService, inferBuildOptions } from '../../bundle'

export default function runBuild(
  options: BuildOptions = {},
  cwd: string = options.absWorkingDir || process.cwd()
) {
  return firstValueFrom(
    BundleService.new(
      inferBuildOptions(options, AvailableCommands.Build, cwd)
    ).build(true)
  )
}
