import {Args, Command, Flags} from '@oclif/core'
import {readFile} from 'node:fs/promises'
import color from '@oclif/color';
import {parse} from 'yaml'
import {apiCall} from '../lib/api'
import {getConfig} from '../lib/config'

export default class Apply extends Command {
  static description = 'Convert Spyglass configuration to native database commands and execute them.'

  static flags = {
    'dry-run': Flags.boolean({description: 'Dry run', default: false}),
    confirm: Flags.boolean({description: 'Skip the interactive prompt (used in CI)', default: false}),
  }

  static args = {
    filename: Args.string({description: 'File to apply configuration for.', required: true}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Apply)

    const cfg = await getConfig(this.config.configDir)

    const file = await readFile(args.filename)
    const contents = parse(file.toString()) as YamlRoles

    const payload = {
      action: 'apply',
      dryRun: true, // first run is always dry, so we can show user what will happen
      files: {
        [args.filename]: contents,
      },
    }

    const res = await apiCall(cfg, payload)
    if (res.data.error) {
      this.log(`Encountered an error: ${res.data.error}, code: ${res.data.code}`)
      return
    }

    // Print SQL differences.
    for (const [accountId, commands] of Object.entries(res.data.sqlCommands)) {
      this.log(color.bold(`Account ${accountId} SQL updates:`))
      for (const command of commands as string[]) {
        this.log(color.cyan(`  ${command}`))
      }
    }

    // We can exit if this is a dry run.
    if (flags['dry-run']) {
      return
    }

    // If confirm isn't provided, get interactive confirmation from user.
    if (!flags.confirm) {
      return
    }

    // Apply configuration to production.
    payload.dryRun = false
    // const res = await apiCall(cfg, payload)
    // if (res.data.error) {
    //   this.log(`Encountered an error: ${res.data.error}, code: ${res.data.code}`)
    //   return
    // }
  }
}

interface YamlRoles {
  [role: string]: YamlRole;
}

interface YamlRole {
  view?: string[];
  inherits?: string[];
}
