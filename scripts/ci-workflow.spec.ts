import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '..')
const runnerPrivatePnpmDestination = '${{ runner.temp }}/setup-pnpm'

// This vendored copy merges directly to master and owns no upstream runner
// labels or self-hosted pools, so ci.yml is the lean hosted contract (see its
// header). These tests pin that contract: the hosted jobs that can honestly
// run here, the push-cancel exemption, the telemetry opt-out, the Sandbox
// workflow's four kernel legs, and the absence of the never-passable GitHub
// starter workflows.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function loadWorkflow(path: string): Record<string, unknown> {
  const document: unknown = yaml.load(readFileSync(resolve(root, path), 'utf8'))
  if (!isRecord(document)) throw new TypeError(`${path} must contain a workflow object`)
  return document
}

// js-yaml parses the bare `on:` key as a boolean, so the trigger map may live
// under either the `on` or the coerced `true` key.
function triggers(workflow: Record<string, unknown>): Record<string, unknown> {
  const value: unknown = 'on' in workflow ? workflow['on'] : workflow['true']
  if (!isRecord(value)) throw new TypeError('workflow must define triggers')
  return value
}

function jobSteps(job: unknown): Record<string, unknown>[] {
  if (!isRecord(job) || !Array.isArray(job.steps)) {
    throw new TypeError('job must define steps')
  }
  return job.steps.filter(isRecord)
}

describe('CI workflow', () => {
  it('isolates every pnpm action setup destination per runner', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    if (!isRecord(workflow.jobs)) throw new TypeError('CI workflow must define jobs')

    const setups = Object.entries(workflow.jobs).flatMap(([jobName, job]) => {
      return jobSteps(job).flatMap((step) => {
        if (typeof step.uses !== 'string' || !step.uses.startsWith('pnpm/action-setup@')) return []
        return [{ jobName, step }]
      })
    })

    expect(setups.length).toBeGreaterThan(0)
    for (const { jobName, step } of setups) {
      expect(step, `${jobName} must not share pnpm/action-setup's default destination`).toMatchObject({
        with: { dest: runnerPrivatePnpmDestination },
      })
    }
  })

  it('runs exactly the two hosted jobs this account can honestly verify', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    if (!isRecord(workflow.jobs)) throw new TypeError('CI workflow must define jobs')

    expect(Object.keys(workflow.jobs).sort()).toEqual(['node-24-unit', 'python-sdk'])
    for (const [name, job] of Object.entries(workflow.jobs)) {
      expect(job, `${name} must stay on standard hosted runners`).toMatchObject({
        'runs-on': 'ubuntu-latest',
      })
    }

    const on = triggers(workflow)
    expect(on.push).toMatchObject({ branches: ['master'] })
    expect(on.pull_request).toBeDefined()

    const unit = jobSteps(workflow.jobs['node-24-unit'])
    const unitRuns = unit.filter((step) => typeof step.run === 'string').map((step) => step.run as string)
    expect(unitRuns.some((run) => run.includes('pnpm install --frozen-lockfile'))).toBe(true)
    expect(unitRuns).toContain('pnpm run test')
    // The hosted pwsh breaks the persistent-pwsh driver (see ci.yml's header);
    // the suites' own skipIf degradation must stay engaged, with no pinned
    // exclusion list anywhere in the workflow.
    expect(unitRuns.some((run) => run.includes('command -v pwsh'))).toBe(true)
    expect(unitRuns.some((run) => run.includes('--exclude'))).toBe(false)

    const sdk = jobSteps(workflow.jobs['python-sdk'])
    const sdkRuns = sdk.filter((step) => typeof step.run === 'string').map((step) => step.run as string)
    expect(sdkRuns).toContain('uv run --python 3.10 --group test --project python/sdk pytest')
  })

  it('exempts push from cancellation, so one master merge does not cancel a running push lane', () => {
    const workflow = loadWorkflow('.github/workflows/ci.yml')
    if (!isRecord(workflow.concurrency)) throw new TypeError('CI workflow must define concurrency')
    expect(workflow.concurrency.group).toBe('${{ github.workflow }}-${{ github.ref }}')
    expect(workflow.concurrency['cancel-in-progress']).toBe("${{ github.event_name != 'push' }}")
  })

  it('never reports to production telemetry from CI', () => {
    for (const path of ['.github/workflows/ci.yml', '.github/workflows/sandbox.yml']) {
      const workflow = loadWorkflow(path)
      if (!isRecord(workflow.env)) throw new TypeError(`${path} must define env`)
      expect(workflow.env.DSH_TELEMETRY_DISABLED, path).toBe('1')
    }
  })

  it('keeps the kernel-confinement Sandbox workflow on all four legs', () => {
    const workflow = loadWorkflow('.github/workflows/sandbox.yml')
    if (!isRecord(workflow.jobs) || !isRecord(workflow.jobs['sandbox-e2e'])) {
      throw new TypeError('Sandbox workflow must define the sandbox-e2e job')
    }
    const matrix = (workflow.jobs['sandbox-e2e'] as Record<string, unknown>).strategy
    if (!isRecord(matrix) || !isRecord(matrix.matrix) || !Array.isArray(matrix.matrix.include)) {
      throw new TypeError('sandbox-e2e must fan out over an OS×runner matrix')
    }
    const runners = (matrix.matrix.include as unknown[])
      .filter(isRecord)
      .map((leg) => leg.runner)
    expect(runners).toEqual(['bwrap', 'landlock', 'landlock', 'seatbelt'])

    const steps = jobSteps(workflow.jobs['sandbox-e2e'])
    const e2e = steps.find((step) => step.name === 'Sandbox e2e (real kernel confinement, world-verified)')
    if (!isRecord(e2e) || typeof e2e.run !== 'string') {
      throw new TypeError('sandbox-e2e must keep the real-kernel e2e step')
    }
    // A self-skipping platform file would pass as a false green; the run
    // guard must keep asserting both files actually ran.
    expect(e2e.run).toContain('Test Files[[:space:]]+2 passed \\(2\\)')
  })

  it('keeps the never-passable GitHub starter workflows out of the workflow set', () => {
    for (const starter of ['webpack.yml', 'datadog-synthetics.yml']) {
      expect(existsSync(resolve(root, '.github/workflows', starter)), starter).toBe(false)
    }
  })
})
