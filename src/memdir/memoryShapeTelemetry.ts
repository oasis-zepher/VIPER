/**
 * Memory-shape telemetry logger.
 *
 * Records metadata about memory recall/write operations for observability.
 * No-op when telemetry is not configured.
 */
import type { MemoryHeader } from './memoryScan.js'
import type { MemoryScope } from '../utils/memoryFileDetection.js'

export const logMemoryRecallShape: (
  _memories: MemoryHeader[],
  _selected: MemoryHeader[],
) => void = () => {}

export const logMemoryWriteShape: (
  _toolName: string,
  _toolInput: Record<string, unknown>,
  _filePath: string,
  _scope: MemoryScope,
) => void = () => {}
