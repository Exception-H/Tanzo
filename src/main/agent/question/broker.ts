import type { AskQuestionAnswer, AskQuestionInput, AskQuestionOutput } from '@shared/agent-message'
import type { PendingQuestion } from '@shared/chat'

export type QuestionReply =
  | { kind: 'answers'; answers: AskQuestionAnswer[] }
  | { kind: 'declined'; note?: string }

export interface QuestionBroker {
  ask(
    chatId: string,
    questionId: string,
    input: AskQuestionInput,
    signal?: AbortSignal
  ): Promise<AskQuestionOutput>
  respond(chatId: string, questionId: string, reply: QuestionReply): Promise<void>
  clearForChat(chatId: string): void
}

interface PendingQuestionState {
  payload: PendingQuestion
  resolve: (output: AskQuestionOutput) => void
  reject: (error: Error) => void
}

function abortError(): Error {
  return Object.assign(new Error('Question was cancelled.'), { name: 'AbortError' })
}

function validateAnswers(input: AskQuestionInput, answers: AskQuestionAnswer[]): void {
  const byId = new Map(input.questions.map((q) => [q.id, q]))
  for (const answer of answers) {
    const question = byId.get(answer.id)
    if (!question) throw new Error(`Answer references unknown question "${answer.id}".`)
    if (answer.type !== question.type) {
      throw new Error(`Answer type for question "${answer.id}" does not match the question.`)
    }
    if (answer.values.length === 0) {
      throw new Error(`Answer for question "${answer.id}" must include at least one value.`)
    }
    if (question.type === 'single_select' && answer.values.length !== 1) {
      throw new Error(`Question "${answer.id}" accepts a single value.`)
    }

    const optionValues = new Set(question.options.map((option) => option.value))

    if (answer.custom) {
      if (!question.allowCustom) {
        throw new Error(`Question "${answer.id}" does not allow custom answers.`)
      }
      if (new Set(answer.values).size !== answer.values.length) {
        throw new Error(`Answer for question "${answer.id}" has duplicate values.`)
      }
      continue
    }

    const seen = new Set<string>()
    for (const value of answer.values) {
      if (!optionValues.has(value)) {
        throw new Error(`Answer value for question "${answer.id}" is not a valid option.`)
      }
      if (seen.has(value)) {
        throw new Error(`Answer for question "${answer.id}" has duplicate values.`)
      }
      seen.add(value)
    }

    if (question.type === 'rank_priorities' && answer.values.length !== question.options.length) {
      throw new Error(`Question "${answer.id}" requires ranking every option exactly once.`)
    }
  }
}

export function createQuestionBroker(): QuestionBroker {
  const pending = new Map<string, PendingQuestionState>()

  function clear(questionId: string): PendingQuestionState | undefined {
    const state = pending.get(questionId)
    pending.delete(questionId)
    return state
  }

  return {
    ask(chatId, questionId, input, signal) {
      const existing = clear(questionId)
      existing?.reject(new Error('Question was replaced by a newer request.'))

      return new Promise<AskQuestionOutput>((resolve, reject) => {
        if (signal?.aborted) {
          reject(abortError())
          return
        }

        const onAbort = (): void => {
          clear(questionId)
          reject(abortError())
        }

        pending.set(questionId, {
          payload: { chatId, questionId, input },
          resolve: (output) => {
            signal?.removeEventListener('abort', onAbort)
            resolve(output)
          },
          reject: (error) => {
            signal?.removeEventListener('abort', onAbort)
            reject(error)
          }
        })
        signal?.addEventListener('abort', onAbort, { once: true })
      })
    },

    async respond(chatId, questionId, reply) {
      const state = clear(questionId)
      if (!state) throw new Error('Question is no longer pending.')
      if (state.payload.chatId !== chatId) throw new Error('Question does not belong to this chat.')
      if (reply.kind === 'declined') {
        state.resolve(reply.note ? { declined: true, note: reply.note } : { declined: true })
        return
      }
      try {
        validateAnswers(state.payload.input, reply.answers)
      } catch (error) {
        state.reject(error instanceof Error ? error : new Error(String(error)))
        throw error
      }
      state.resolve({ answers: reply.answers })
    },

    clearForChat(chatId) {
      for (const state of [...pending.values()]) {
        if (state.payload.chatId !== chatId) continue
        clear(state.payload.questionId)?.reject(abortError())
      }
    }
  }
}
