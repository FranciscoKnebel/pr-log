import path from 'path';
import prepend from 'prepend';
import promisify from 'util.promisify';
import semver from 'semver';
import ensureCleanLocalGitState from './ensureCleanLocalGitState';
import getMergedPullRequests from './getMergedPullRequests';
import createChangelog from './createChangelog';
import getGithubRepo from './getGithubRepo';
import defaultValidLabels from './validLabels';

const prependFile = promisify(prepend);

function stripTrailingEmptyLine(text) {
    if (text.lastIndexOf('\n\n') === text.length - 2) {
        return text.slice(0, -1);
    }

    return text;
}

function getValidLabels(prLogConfig) {
    return prLogConfig && prLogConfig.validLabels || defaultValidLabels;
}

function validateVersionnumber(versionNumber) {
    if (!versionNumber) {
        throw new Error('version-number not specified');
    }
    if (semver.valid(versionNumber) === null) {
        throw new Error('version-number is invalid');
    }
}

export default function createCliAgent(dependencies) {
    async function generateChangelog(options, githubRepo, validLabels, newVersionNumber) {
        if (!options.sloppy) {
            await ensureCleanLocalGitState(githubRepo);
        }

        const pullRequests = await getMergedPullRequests(githubRepo, validLabels, dependencies);
        const changelog = await createChangelog(newVersionNumber, validLabels, pullRequests);

        return stripTrailingEmptyLine(changelog);
    }

    return {
        run: async (newVersionNumber, options) => {
            const packageConfig = require(path.join(process.cwd(), 'package.json'));
            const githubRepo = getGithubRepo(packageConfig.repository.url);
            const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
            const prLogConfig = packageConfig['pr-log'];
            const validLabels = getValidLabels(prLogConfig);

            validateVersionnumber(newVersionNumber);

            const changelog = await generateChangelog(options, githubRepo, validLabels, newVersionNumber);
            await prependFile(changelogPath, changelog);
        }
    };
}
