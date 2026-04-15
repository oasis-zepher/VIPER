import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'
import { join, resolve } from 'path'
import { getClaudeConfigHomeDir } from '../utils/envUtils.js'
import { errorMessage } from '../utils/errors.js'

const EXIT_CODE_PERMANENT = 78
const BACKOFF_INITIAL_MS = 2_000
const BACKOFF_CAP_MS = 120_000
const BACKOFF_MULTIPLIER = 2
const MAX_RAPID_FAILURES = 5

interface WorkerState {
  kind: string
  process: ChildProcess | null
  backoffMs: number
  failureCount: number
  parked: boolean
  lastStartTime: number
}

type DaemonPidState = {
  pid: number
  startedAt: string
  cwd: string
}

function getDaemonStateDir(): string {
  return join(getClaudeConfigHomeDir(), 'daemon')
}

function getDaemonPidFilePath(): string {
  return join(getDaemonStateDir(), 'remote-control-server.json')
}

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function readDaemonPidState(): DaemonPidState | null {
  try {
    const raw = readFileSync(getDaemonPidFilePath(), 'utf8')
    const parsed = JSON.parse(raw) as Partial<DaemonPidState>
    if (
      typeof parsed.pid !== 'number' ||
      typeof parsed.startedAt !== 'string' ||
      typeof parsed.cwd !== 'string'
    ) {
      return null
    }
    return {
      pid: parsed.pid,
      startedAt: parsed.startedAt,
      cwd: parsed.cwd,
    }
  } catch {
    return null
  }
}

function writeDaemonPidState(cwd: string): void {
  mkdirSync(getDaemonStateDir(), { recursive: true })
  writeFileSync(
    getDaemonPidFilePath(),
    JSON.stringify(
      {
        pid: process.pid,
        startedAt: new Date().toISOString(),
        cwd,
      } satisfies DaemonPidState,
      null,
      2,
    ),
    'utf8',
  )
}

function removeDaemonPidState(): void {
  const current = readDaemonPidState()
  if (current && current.pid !== process.pid) {
    return
  }
  rmSync(getDaemonPidFilePath(), { force: true })
}

export async function daemonMain(args: string[]): Promise<void> {
  const subcommand = args[0] || 'start'

  switch (subcommand) {
    case 'start':
      await runSupervisor(args.slice(1))
      break
    case 'status':
      printDaemonStatus()
      break
    case 'stop':
      await stopDaemon()
      break
    case '--help':
    case '-h':
      printHelp()
      break
    default:
      console.error(`Unknown daemon subcommand: ${subcommand}`)
      printHelp()
      process.exitCode = 1
  }
}

function printHelp(): void {
  console.log(`
Claude Code Daemon — persistent background supervisor

USAGE
  claude daemon [subcommand] [options]

SUBCOMMANDS
  start       Start the daemon supervisor (default)
  status      Show worker status
  stop        Stop the daemon

OPTIONS
  --dir <path>              Working directory (default: current)
  --spawn-mode <mode>       Worker spawn mode: same-dir | worktree (default: same-dir)
  --capacity <N>            Max concurrent sessions per worker (default: 4)
  --permission-mode <mode>  Permission mode for spawned sessions
  --sandbox                 Enable sandbox mode
  --name <name>             Session name
  -h, --help                Show this help
`)
}

function parseSupervisorArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!
    if (arg === '--dir' && i + 1 < args.length) {
      result.dir = resolve(args[++i]!)
    } else if (arg.startsWith('--dir=')) {
      result.dir = resolve(arg.slice('--dir='.length))
    } else if (arg === '--spawn-mode' && i + 1 < args.length) {
      result.spawnMode = args[++i]!
    } else if (arg.startsWith('--spawn-mode=')) {
      result.spawnMode = arg.slice('--spawn-mode='.length)
    } else if (arg === '--capacity' && i + 1 < args.length) {
      result.capacity = args[++i]!
    } else if (arg.startsWith('--capacity=')) {
      result.capacity = arg.slice('--capacity='.length)
    } else if (arg === '--permission-mode' && i + 1 < args.length) {
      result.permissionMode = args[++i]!
    } else if (arg.startsWith('--permission-mode=')) {
      result.permissionMode = arg.slice('--permission-mode='.length)
    } else if (arg === '--sandbox') {
      result.sandbox = '1'
    } else if (arg === '--name' && i + 1 < args.length) {
      result.name = args[++i]!
    } else if (arg.startsWith('--name=')) {
      result.name = arg.slice('--name='.length)
    }
  }
  return result
}

async function runSupervisor(args: string[]): Promise<void> {
  const config = parseSupervisorArgs(args)
  const dir = config.dir || resolve('.')
  const existing = readDaemonPidState()

  if (existing && isProcessRunning(existing.pid)) {
    console.log(
      `[daemon] remote-control-server already running (pid=${existing.pid}, cwd=${existing.cwd})`,
    )
    return
  }

  if (existing && !isProcessRunning(existing.pid)) {
    removeDaemonPidState()
  }

  writeDaemonPidState(dir)

  console.log(`[daemon] supervisor starting in ${dir}`)

  const workers: WorkerState[] = [
    {
      kind: 'remoteControl',
      process: null,
      backoffMs: BACKOFF_INITIAL_MS,
      failureCount: 0,
      parked: false,
      lastStartTime: 0,
    },
  ]

  const controller = new AbortController()

  const shutdown = () => {
    console.log('[daemon] supervisor shutting down...')
    controller.abort()
    for (const w of workers) {
      if (w.process && !w.process.killed) {
        w.process.kill('SIGTERM')
      }
    }
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  for (const worker of workers) {
    if (!controller.signal.aborted) {
      spawnWorker(worker, dir, config, controller.signal)
    }
  }

  await new Promise<void>(resolve => {
    if (controller.signal.aborted) {
      resolve()
      return
    }
    controller.signal.addEventListener('abort', () => resolve(), { once: true })
  })

  await Promise.all(
    workers
      .filter(w => w.process && !w.process.killed)
      .map(
        w =>
          new Promise<void>(resolve => {
            if (!w.process) {
              resolve()
              return
            }
            w.process.on('exit', () => resolve())
            setTimeout(() => {
              if (w.process && !w.process.killed) {
                w.process.kill('SIGKILL')
              }
              resolve()
            }, 30_000)
          }),
      ),
  )

  console.log('[daemon] supervisor stopped')
  removeDaemonPidState()
}

function spawnWorker(
  worker: WorkerState,
  dir: string,
  config: Record<string, string>,
  signal: AbortSignal,
): void {
  if (signal.aborted || worker.parked) return

  worker.lastStartTime = Date.now()

  const env: Record<string, string | undefined> = {
    ...process.env,
    DAEMON_WORKER_DIR: dir,
    DAEMON_WORKER_NAME: config.name,
    DAEMON_WORKER_SPAWN_MODE: config.spawnMode || 'same-dir',
    DAEMON_WORKER_CAPACITY: config.capacity || '4',
    DAEMON_WORKER_PERMISSION: config.permissionMode,
    DAEMON_WORKER_SANDBOX: config.sandbox || '0',
    DAEMON_WORKER_CREATE_SESSION: '1',
    CLAUDE_CODE_SESSION_KIND: 'daemon-worker',
  }

  const execArgs = [
    ...process.execArgv,
    process.argv[1]!,
    `--daemon-worker=${worker.kind}`,
  ]

  console.log(`[daemon] spawning worker '${worker.kind}'`)

  const child = spawn(process.execPath, execArgs, {
    env,
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  worker.process = child

  child.stdout?.on('data', (data: Buffer) => {
    const lines = data.toString().trimEnd().split('\n')
    for (const line of lines) {
      console.log(`  ${line}`)
    }
  })
  child.stderr?.on('data', (data: Buffer) => {
    const lines = data.toString().trimEnd().split('\n')
    for (const line of lines) {
      console.error(`  ${line}`)
    }
  })

  child.on('exit', (code, sig) => {
    worker.process = null

    if (signal.aborted) {
      return
    }

    if (code === 0) {
      console.log(`[daemon] worker '${worker.kind}' exited cleanly`)
      return
    }

    if (code === EXIT_CODE_PERMANENT) {
      worker.parked = true
      console.error(
        `[daemon] worker '${worker.kind}' failed permanently and is parked`,
      )
      return
    }

    const runtimeMs = Date.now() - worker.lastStartTime
    if (runtimeMs < 10_000) {
      worker.failureCount += 1
      if (worker.failureCount >= MAX_RAPID_FAILURES) {
        worker.parked = true
        console.error(
          `[daemon] worker '${worker.kind}' crashed ${worker.failureCount} times rapidly and is parked`,
        )
        return
      }
    } else {
      worker.failureCount = 0
      worker.backoffMs = BACKOFF_INITIAL_MS
    }

    console.error(
      `[daemon] worker '${worker.kind}' exited (code=${code}, signal=${sig}), restarting in ${worker.backoffMs}ms`,
    )
    const delay = worker.backoffMs
    worker.backoffMs = Math.min(
      worker.backoffMs * BACKOFF_MULTIPLIER,
      BACKOFF_CAP_MS,
    )
    setTimeout(() => {
      if (!signal.aborted) {
        spawnWorker(worker, dir, config, signal)
      }
    }, delay)
  })

  child.on('error', err => {
    worker.process = null
    console.error(
      `[daemon] worker '${worker.kind}' failed to spawn: ${errorMessage(err)}`,
    )
  })
}

function printDaemonStatus(): void {
  const current = readDaemonPidState()
  if (!current) {
    console.log('daemon status: stopped')
    return
  }

  if (!isProcessRunning(current.pid)) {
    console.log(
      `daemon status: stale pid file found for pid ${current.pid} at ${current.cwd}`,
    )
    removeDaemonPidState()
    return
  }

  console.log('daemon status: running')
  console.log(`  pid: ${current.pid}`)
  console.log(`  cwd: ${current.cwd}`)
  console.log(`  startedAt: ${current.startedAt}`)
}

async function stopDaemon(): Promise<void> {
  const current = readDaemonPidState()
  if (!current) {
    console.log('daemon stop: no running daemon found')
    return
  }

  if (!isProcessRunning(current.pid)) {
    console.log(
      `daemon stop: removing stale pid file for pid ${current.pid} (${current.cwd})`,
    )
    removeDaemonPidState()
    return
  }

  console.log(`[daemon] stopping remote-control-server (pid=${current.pid})`)
  process.kill(current.pid, 'SIGTERM')

  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (!isProcessRunning(current.pid)) {
      removeDaemonPidState()
      console.log('[daemon] remote-control-server stopped')
      return
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  console.log(
    `[daemon] pid ${current.pid} did not exit after SIGTERM, sending SIGKILL`,
  )
  process.kill(current.pid, 'SIGKILL')
  removeDaemonPidState()
  console.log('[daemon] remote-control-server stopped')
}
