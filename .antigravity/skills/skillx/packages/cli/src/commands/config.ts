import { Command } from 'commander';
import chalk from 'chalk';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { getApiKey, setApiKey, getBaseUrl, setBaseUrl } from '../utils/config-store.js';

export const configCommand = new Command('config')
  .description('Manage SkillX CLI configuration');

configCommand
  .command('set-key')
  .description('Set your SkillX API key')
  .action(async () => {
    const rl = readline.createInterface({ input, output });

    try {
      console.log(chalk.bold('\nSkillX API Key Configuration'));
      console.log(chalk.dim('Get your API key from: https://skillx.sh/settings/api\n'));

      const apiKey = await rl.question(chalk.cyan('Enter your API key: '));

      if (!apiKey || apiKey.trim().length === 0) {
        console.error(chalk.red('\n✗ API key cannot be empty'));
        process.exit(1);
      }

      setApiKey(apiKey.trim());
      console.log(chalk.green('\n✓ API key saved successfully'));
      console.log(
        chalk.dim(
          `Stored in: ${process.platform === 'win32' ? '%APPDATA%' : '~'}/.config/skillx/config.json`
        )
      );
    } catch (error) {
      if (error instanceof Error) {
        console.error(chalk.red(`\n✗ Error: ${error.message}`));
      }
      process.exit(1);
    } finally {
      rl.close();
    }
  });

configCommand
  .command('set-url')
  .description('Set custom API base URL (default: https://skillx.sh)')
  .argument('<url>', 'Base URL for SkillX API')
  .action((url: string) => {
    try {
      new URL(url);
      setBaseUrl(url);
      console.log(chalk.green(`\n✓ Base URL set to: ${url}`));
    } catch {
      console.error(chalk.red('\n✗ Invalid URL format'));
      console.error(chalk.dim('Example: https://api.skillx.sh'));
      process.exit(1);
    }
  });

configCommand
  .command('show')
  .description('Display current configuration')
  .action(() => {
    const apiKey = getApiKey();
    const baseUrl = getBaseUrl();

    console.log(chalk.bold('\nSkillX Configuration:\n'));
    console.log(chalk.cyan('Base URL:'), baseUrl);

    if (apiKey) {
      const masked = `${apiKey.substring(0, 8)}${'*'.repeat(Math.max(0, apiKey.length - 12))}${apiKey.substring(Math.max(8, apiKey.length - 4))}`;
      console.log(chalk.cyan('API Key: '), masked);

      if (process.env.SKILLX_API_KEY) {
        console.log(chalk.dim('  (loaded from SKILLX_API_KEY environment variable)'));
      } else {
        console.log(
          chalk.dim(
            `  (loaded from ${process.platform === 'win32' ? '%APPDATA%' : '~'}/.config/skillx/config.json)`
          )
        );
      }
    } else {
      console.log(chalk.cyan('API Key: '), chalk.dim('not configured'));
      console.log(
        chalk.dim(`  Run ${chalk.cyan('skillx config set-key')} to configure`)
      );
    }

    console.log();
  });
