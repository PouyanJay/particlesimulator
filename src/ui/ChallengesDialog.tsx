import { useEffect, useState } from 'react'
import { useUiStore } from '../state/uiStore'
import { useParamStore } from '../state/paramStore'
import { useTelemetryStore } from '../state/telemetryStore'
import { simRegistry } from '../state/simRegistry'
import { allChallenges } from '../sim-core/challenges/library'
import type { Challenge } from '../sim-core/challenges/types'
import type { Telemetry } from '../sim-core/types'
import { Dialog } from './controls/Dialog'
import { Button } from './controls/Button'
import { ButtonGroup } from './controls/ButtonGroup'
import { CheckIcon } from './icons'

function modeLabel(modeId: string): string {
  return simRegistry.list().find((m) => m.id === modeId)?.label ?? modeId
}

/**
 * Guided challenges: pick a lesson, then step through predict-then-observe prompts. Steps with
 * an auto-graded criterion are checked live against the running simulation's telemetry, so the
 * learner sees the goal turn green as the physics confirms the prediction.
 */
export function ChallengesDialog() {
  const open = useUiStore((s) => s.overlay === 'challenges')
  const close = useUiStore((s) => s.closeOverlay)
  const [active, setActive] = useState<Challenge | null>(null)

  function start(challenge: Challenge): void {
    // Drop into the challenge's mode at its defaults so everyone starts from the same place.
    if (useParamStore.getState().modeId !== challenge.modeId) {
      useParamStore.getState().selectMode(challenge.modeId)
    }
    setActive(challenge)
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={active ? active.title : 'Guided challenges'}
      description={active ? active.summary : 'Short, hands-on lessons that build intuition.'}
    >
      {active ? (
        <ChallengeRunner challenge={active} onExit={() => setActive(null)} />
      ) : (
        <div className="cards">
          {allChallenges.map((challenge) => (
            <button key={challenge.id} className="card" onClick={() => start(challenge)}>
              <span className="card__title">{challenge.title}</span>
              <span className="card__summary">{challenge.summary}</span>
              <span className="card__meta">{modeLabel(challenge.modeId)}</span>
            </button>
          ))}
        </div>
      )}
    </Dialog>
  )
}

function ChallengeRunner({ challenge, onExit }: { challenge: Challenge; onExit: () => void }) {
  const [stepIndex, setStepIndex] = useState(0)
  const [baseline, setBaseline] = useState<Telemetry | undefined>(undefined)
  const telemetry = useTelemetryStore((s) => s.current)
  const params = useParamStore((s) => s.params)

  const step = challenge.steps[stepIndex]
  const isLast = stepIndex === challenge.steps.length - 1

  // Capture a baseline when a step begins, so relative ("increased from") checks have a reference.
  useEffect(() => {
    setBaseline(useTelemetryStore.getState().current ?? undefined)
  }, [stepIndex])

  const met = step.check && telemetry ? step.check.evaluate({ telemetry, params, baseline }) : false

  return (
    <div className="challenge">
      <p className="challenge__progress">
        Step {stepIndex + 1} of {challenge.steps.length}
      </p>
      <p className="challenge__prompt">{step.prompt}</p>
      {step.hint ? <p className="challenge__hint">{step.hint}</p> : null}

      {step.check ? (
        <div className={`challenge__check${met ? ' is-met' : ''}`}>
          {met ? <CheckIcon /> : <span className="challenge__check-dot" aria-hidden="true" />}
          <span>{step.check.describe}</span>
        </div>
      ) : null}

      <ButtonGroup justify="between">
        <Button onClick={onExit}>All challenges</Button>
        <ButtonGroup>
          <Button onClick={() => setStepIndex((i) => Math.max(0, i - 1))} disabled={stepIndex === 0}>
            Back
          </Button>
          {isLast ? (
            <Button variant="primary" onClick={onExit}>
              Finish
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setStepIndex((i) => i + 1)}>
              Next
            </Button>
          )}
        </ButtonGroup>
      </ButtonGroup>
    </div>
  )
}
