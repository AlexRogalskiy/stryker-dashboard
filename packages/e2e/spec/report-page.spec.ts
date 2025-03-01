import { test, expect } from '@playwright/test';
import { MutantStatus } from 'mutation-testing-report-schema';
import { ReportPage } from '../po/reports/report-page.po.js';
import { simpleReport, scoreOnlyReport } from '../actions/report.action.js';
import { ReportClient } from '../po/reports/report-client.po.js';

test.describe('Report page', () => {
  let page: ReportPage;
  let client: ReportClient;

  test.beforeEach(({ page: p, request }) => {
    page = new ReportPage(p);
    client = new ReportClient(request);
  });

  test.describe('when report does not exist', () => {
    test.beforeEach(async () => {
      await page.navigate('a/b/c', 'd');
    });

    test('should show an error message', async () => {
      await expect(page.errorAlert).toContainText('Report does not exist');
    });
  });

  test.describe('when a full report exists', async () => {
    test.beforeEach(async () => {
      await client.uploadReport(
        simpleReport(
          'github.com/stryker-mutator-test-organization/hello-org',
          'master'
        )
      );
      await page.navigate(
        'github.com/stryker-mutator-test-organization/hello-org',
        'master'
      );
    });

    test('should show the mutation-test-report-app with bound data', async () => {
      const app = page.mutationTestReportApp;
      await expect(app.title).toContainText(
        'All files - hello-org/master - Stryker Dashboard'
      );
      expect(await app.mutationScore()).toBe(33.33);
    });

    test.describe(
      'and afterwards it is overridden with a score-only report',
      async () => {
        test.beforeEach(async () => {
          await client.uploadReport(
            scoreOnlyReport(
              'github.com/stryker-mutator-test-organization/hello-org',
              'master',
              42
            )
          );
          await page.navigate(
            'github.com/stryker-mutator-test-organization/hello-org',
            'master'
          );
        });

        test('should show the mutation score only', async () => {
          await expect(page.warningAlert).toContainText(
            'No html report stored for github.com/stryker-mutator-test-organization/hello-org/master'
          );
          await expect(page.mutationTestReportApp.host).not.toExist();
          await expect(page.mutationScore).toContainText('Mutation score: 42');
        });
      }
    );
  });

  test.describe(
    'when multiple reports with module names are updated for one project',
    () => {
      test.beforeEach(async () => {
        await Promise.all([
          client.uploadReport(
            simpleReport(
              'github.com/stryker-mutator-test-organization/hello-org',
              'feat/modules',
              'one',
              [MutantStatus.Killed, MutantStatus.Killed, MutantStatus.Killed]
            )
          ),
          client.uploadReport(
            simpleReport(
              'github.com/stryker-mutator-test-organization/hello-org',
              'feat/modules',
              'two',
              [
                MutantStatus.Survived,
                MutantStatus.Survived,
                MutantStatus.Survived,
              ]
            )
          ),
          client.uploadReport(
            simpleReport(
              'github.com/stryker-mutator-test-organization/hello-org',
              'feat/modules',
              'three',
              [
                MutantStatus.Killed,
                MutantStatus.Timeout,
                MutantStatus.NoCoverage,
              ]
            )
          ),
        ]);
        await page.navigate(
          'github.com/stryker-mutator-test-organization/hello-org',
          'feat/modules'
        );
      });

      test('should show the aggregated report for the project', async () => {
        await expect(page.mutationTestReportApp.title).toContainText(
          'All files - hello-org/feat/modules - Stryker Dashboard'
        );
        expect(await page.mutationTestReportApp.mutationScore()).toBe(55.56);
        expect(await page.mutationTestReportApp.fileNames()).toEqual([
          'one/test.js',
          'three/test.js',
          'two/test.js',
        ]);
      });
    }
  );
});
