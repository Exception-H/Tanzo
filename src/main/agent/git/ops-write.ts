import type {
  GitCheckoutInput,
  GitCheckoutRemoteBranchInput,
  GitCommitInput,
  GitCommitResult,
  GitCreateBranchInput,
  GitDeleteBranchInput,
  GitFetchInput,
  GitInitInput,
  GitOverview,
  GitPathsInput,
  GitPullInput,
  GitPushInput,
  GitRemoteAddInput,
  GitRemoteInfo,
  GitRemoteRemoveInput,
  GitResult,
  GitSetUserInput,
  GitStatusSnapshot,
  GitUserInfo
} from '@shared/git'
import { fail, ok } from './errors'
import { readOverview, readRemotes, readStatus, readUser, type GitClientPool } from './ops'

function assertNotOption(value: string, label: string): void {
  if (value.startsWith('-') || value.includes('\0')) {
    throw new Error(`Invalid ${label}: "${value}".`)
  }
}

const ALLOWED_REMOTE_SCHEMES = new Set(['https:', 'ssh:', 'git:', 'http:', 'file:'])

function assertSafeRemoteUrl(url: string): void {
  assertNotOption(url, 'remote url')
  let scheme: string | null = null
  try {
    scheme = new URL(url).protocol
  } catch {
    if (/^[\w.-]+@[\w.-]+:/.test(url)) return
    throw new Error(`Invalid remote url: "${url}".`)
  }
  if (!ALLOWED_REMOTE_SCHEMES.has(scheme)) {
    throw new Error(`Unsupported remote url scheme: "${scheme}".`)
  }
}

export async function stage(
  pool: GitClientPool,
  input: GitPathsInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    if (input.paths.length === 0) return readStatus(pool, input.cwd)
    await pool.client(input.cwd).add([...input.paths])
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function restoreStaged(
  pool: GitClientPool,
  input: GitPathsInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    if (input.paths.length === 0) return readStatus(pool, input.cwd)
    await pool.client(input.cwd).reset(['--', ...input.paths])
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function restoreWorktree(
  pool: GitClientPool,
  input: GitPathsInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    if (input.paths.length === 0) return readStatus(pool, input.cwd)
    await pool.client(input.cwd).checkout(['--', ...input.paths])
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function discard(
  pool: GitClientPool,
  input: GitPathsInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    if (input.paths.length === 0) return readStatus(pool, input.cwd)
    const git = pool.client(input.cwd)
    await git.reset(['--', ...input.paths]).catch(() => undefined)
    await git.checkout(['--', ...input.paths]).catch(() => undefined)
    await git.clean('f', ['--', ...input.paths]).catch(() => undefined)
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function commit(
  pool: GitClientPool,
  input: GitCommitInput
): Promise<GitResult<GitCommitResult>> {
  try {
    const options: string[] = []
    if (input.amend) options.push('--amend')
    if (input.noEdit) options.push('--no-edit')
    if (input.signoff) options.push('--signoff')
    const result = await pool.client(input.cwd).commit(input.message ?? '', options)
    return ok({
      hash: result.commit,
      message: input.message ?? '',
      branch: result.branch
    })
  } catch (error) {
    return fail(error)
  }
}

export async function fetch(
  pool: GitClientPool,
  input: GitFetchInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    if (input.remote) assertNotOption(input.remote, 'remote')
    await pool.client(input.cwd).fetch(input.remote ? [input.remote] : [])
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function pull(
  pool: GitClientPool,
  input: GitPullInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    const git = pool.client(input.cwd)
    if (input.remote && input.branch) {
      assertNotOption(input.remote, 'remote')
      assertNotOption(input.branch, 'branch')
      await git.pull(input.remote, input.branch)
    } else await git.pull()
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function push(
  pool: GitClientPool,
  input: GitPushInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    const git = pool.client(input.cwd)
    const options: string[] = []
    if (input.forceWithLease) {
      options.push(input.lease ? `--force-with-lease=${input.lease}` : '--force-with-lease')
    }
    if (input.remote && input.branch) {
      assertNotOption(input.remote, 'remote')
      assertNotOption(input.branch, 'branch')
      await git.push(input.remote, input.branch, options)
    } else await git.push(options)
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function checkout(
  pool: GitClientPool,
  input: GitCheckoutInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    assertNotOption(input.ref, 'ref')
    await pool.client(input.cwd).checkout(input.ref)
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function checkoutRemoteBranch(
  pool: GitClientPool,
  input: GitCheckoutRemoteBranchInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    assertNotOption(input.remoteBranch, 'remote branch')
    const local = input.localBranch ?? input.remoteBranch.split('/').slice(1).join('/')
    assertNotOption(local, 'branch')
    await pool.client(input.cwd).checkout(['-b', local, '--track', input.remoteBranch])
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function createBranch(
  pool: GitClientPool,
  input: GitCreateBranchInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    assertNotOption(input.name, 'branch')
    if (input.startPoint) assertNotOption(input.startPoint, 'start point')
    const args = ['-b', input.name, ...(input.startPoint ? [input.startPoint] : [])]
    await pool.client(input.cwd).checkout(args)
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function deleteBranch(
  pool: GitClientPool,
  input: GitDeleteBranchInput
): Promise<GitResult<GitStatusSnapshot>> {
  try {
    assertNotOption(input.name, 'branch')
    await pool.client(input.cwd).deleteLocalBranch(input.name, input.force ?? false)
    return readStatus(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function addRemote(
  pool: GitClientPool,
  input: GitRemoteAddInput
): Promise<GitResult<readonly GitRemoteInfo[]>> {
  try {
    assertNotOption(input.name, 'remote')
    assertSafeRemoteUrl(input.url)
    const git = pool.client(input.cwd)
    await git.addRemote(input.name, input.url)
    if (input.fetch) await git.fetch(input.name)
    return readRemotes(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function removeRemote(
  pool: GitClientPool,
  input: GitRemoteRemoveInput
): Promise<GitResult<readonly GitRemoteInfo[]>> {
  try {
    await pool.client(input.cwd).removeRemote(input.name)
    return readRemotes(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function init(
  pool: GitClientPool,
  input: GitInitInput
): Promise<GitResult<GitOverview>> {
  try {
    const args = input.initialBranch ? ['-b', input.initialBranch] : []
    await pool.client(input.cwd).init(args)
    return readOverview(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}

export async function setUser(
  pool: GitClientPool,
  input: GitSetUserInput
): Promise<GitResult<GitUserInfo>> {
  try {
    const git = pool.client(input.cwd)
    const scopeArg = input.scope === 'global' ? ['--global'] : []
    await git.raw(['config', ...scopeArg, 'user.name', input.name])
    await git.raw(['config', ...scopeArg, 'user.email', input.email])
    return readUser(pool, input.cwd)
  } catch (error) {
    return fail(error)
  }
}
