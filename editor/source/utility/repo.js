import { WORKSPACE_BRANCH_PREFIX } from '../editor/menu/workspace'

export default class Repo {
  constructor(branch, branches, commits, remote_url, revision, web_url) {
    this.branch = branch
    this.branches = branches
    this.commits = commits
    this.remote_url = remote_url
    this.revision = revision
    this.web_url = web_url
  }

  cleanBranch(branch_id) {
    if (branch_id.startsWith(WORKSPACE_BRANCH_PREFIX)) {
      return branch_id.slice(WORKSPACE_BRANCH_PREFIX.length)
    }
    return branch_id
  }

  webUrlForBranch(branch) {
    if (branch != 'master') {
      if (this.web_url.includes('github.com')) {
        return `${this.web_url}/tree/${branch}`
      } else if (this.web_url.includes('source.cloud.google.com')) {
        return `${this.web_url}/+/${branch}:`
      }
    }
    return this.web_url
  }

  webUrlForCommit(commitHash) {
    if (this.web_url.includes('github.com')) {
      return `${this.web_url}/commit/${commitHash}`
    } else if (this.web_url.includes('source.cloud.google.com')) {
      return `${this.web_url}/+/${commitHash}`
    }
    return this.web_url
  }
}
