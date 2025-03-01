/* eslint-disable no-undef */
// @ts-check

/**
 * This file will determine the next canary version number, setting it in the NPM_PACKAGE_VERSION variable for all next actions to use.
 * Instead of Lerna's algorithm, it validates that the next version does not yet exist.
 * Unfortunately Lerna itself doesn't support this
 */
import core from '@actions/core';
import axios from 'axios';
import semver from 'semver';
import fs from 'fs';

const { version: currentVersion } = JSON.parse(
  fs.readFileSync(new URL('../lerna.json', import.meta.url), 'utf-8')
);

determineNextCanaryVersion().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

async function determineNextCanaryVersion() {
  const ref = determineRef();
  const preId = sanitize(ref);
  const nextPatchVersion = semver.inc(currentVersion, 'patch');
  const { versions } = (
    await axios('https://registry.npmjs.org/@stryker-mutator/dashboard-backend')
  ).data;
  const revision = determineNextFreeRevision(nextPatchVersion, preId, versions);
  const npmVersion = formatVersion(nextPatchVersion, preId, revision);
  core.exportVariable('NPM_PACKAGE_VERSION', npmVersion);
  console.log(npmVersion);
}

/**
 * @param {string} version
 * @param {string} preId
 * @param {number} revision
 */
function formatVersion(version, preId, revision) {
  return `${version}-${preId}.${revision}`;
}

/**
 * @param {string} ref
 */
function sanitize(ref) {
  // Sanitizes a github ref name to be a valid pre-id according to semver spec: https://semver.org/#spec-item-9
  return ref.replace(/\//g, '-');
}

function determineRef() {
  const rawRef = process.env.GITHUB_REF;
  if (!rawRef) {
    throw new Error('Env variable GITHUB_REF was not set!');
  }
  // rawRef will be in the form "refs/pull/:prNumber/merge" or "refs/heads/feat/branch-1"
  const [, type, ...name] = rawRef.split('/');
  if (type === 'pull') {
    return `pr-${name[0]}`;
  } else {
    return name.join('/');
  }
}

function determineNextFreeRevision(version, preId, existingVersions) {
  let revision = 0;
  while (formatVersion(version, preId, revision) in existingVersions) {
    revision++;
  }
  return revision;
}
