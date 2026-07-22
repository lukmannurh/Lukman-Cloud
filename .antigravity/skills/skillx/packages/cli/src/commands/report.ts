import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { apiRequest, ApiError } from '../lib/api-client.js';
import { getApiKey } from '../utils/config-store.js';

interface ReportPayload {
  skill_slug: string;
  outcome: 'success' | 'failure' | 'partial';
  model?: string;
  duration_ms?: number;
}

interface ReportResponse {
  success: boolean;
  message: string;
}

export const reportCommand = new Command('report')
  .description('Report skill usage to SkillX (requires API key)')
  .argument('<slug>', 'Skill slug identifier')
  .argument('<outcome>', 'Outcome: success, failure, or partial')
  .option('-m, --model <model>', 'AI model used (e.g., claude-sonnet-4)')
  .option('-d, --duration <ms>', 'Execution duration in milliseconds', parseFloat)
  .action(
    async (slug: string, outcome: string, options: { model?: string; duration?: number }) => {
      const apiKey = getApiKey();
      if (!apiKey) {
        console.error(chalk.red('\n✗ API key required for reporting'));
        console.error(
          chalk.dim(`Configure your API key with: ${chalk.cyan('skillx config set-key')}`)
        );
        process.exit(1);
      }

      if (!['success', 'failure', 'partial'].includes(outcome)) {
        console.error(chalk.red('\n✗ Invalid outcome. Must be: success, failure, or partial'));
        process.exit(1);
      }

      const spinner = ora(`Reporting usage for ${slug}...`).start();

      try {
        const payload: ReportPayload = {
          skill_slug: slug,
          outcome: outcome as 'success' | 'failure' | 'partial',
        };

        if (options.model) {
          payload.model = options.model;
        }

        if (options.duration !== undefined) {
          payload.duration_ms = options.duration;
        }

        const response = await apiRequest<ReportResponse>('/api/report', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        spinner.stop();
        console.log(chalk.green(`\n✓ ${response.message}`));
        console.log(
          chalk.dim(`Reported ${chalk.bold(outcome)} for skill: ${chalk.cyan(slug)}`)
        );
      } catch (error) {
        spinner.stop();

        if (error instanceof ApiError) {
          if (error.status === 401) {
            console.error(chalk.red('\n✗ Invalid API key'));
            console.error(
              chalk.dim(`Update your API key with: ${chalk.cyan('skillx config set-key')}`)
            );
          } else if (error.status === 404) {
            console.error(chalk.red(`\n✗ Skill not found: ${slug}`));
          } else {
            console.error(chalk.red(`\n✗ API Error: ${error.message}`));
          }
        } else if (error instanceof Error) {
          console.error(chalk.red(`\n✗ Network Error: ${error.message}`));
          console.error(chalk.dim('Check your internet connection or try again later.'));
        } else {
          console.error(chalk.red('\n✗ An unexpected error occurred'));
        }
        process.exit(1);
      }
    }
  );
