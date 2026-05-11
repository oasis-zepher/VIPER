export type QueueOperation = 'enqueue' | 'dequeue' | 'remove' | string

export interface QueueOperationMessage {
  type: 'queue-operation'
  operation: QueueOperation
  timestamp: string
  sessionId: string
  content?: string
  [key: string]: unknown
}
