/**
 * Context-collapse view projection.
 *
 * Rebuilds the collapsed message view from commit entries stored in the
 * message array. When context collapse is disabled, projectView is the
 * identity function — messages pass through unchanged.
 */
import type { Message } from 'src/types/message.js'

export const projectView: (messages: Message[]) => Message[] = messages => messages
