import { feature } from 'bun:bundle'
import type { Command } from '../../commands.js'

function isEnabled(): boolean {
  if (!feature('DAEMON')) return false
  return feature('BRIDGE_MODE') ? true : false
}

const remoteControlServer = {
  type: 'local-jsx',
  name: 'remote-control-server',
  aliases: ['rcs'],
  description:
    'Start a persistent Remote Control server (daemon) that accepts multiple sessions',
  isEnabled,
  get isHidden() {
    return !isEnabled()
  },
  immediate: true,
  load: () => import('./remoteControlServer.js'),
} satisfies Command

export default remoteControlServer
