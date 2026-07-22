import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { apiRequest, ApiError } from '../lib/api-client.js';

interface SearchResult {
  slug: string;
  name: string;
  category: string;
  rating: number;
  description: string;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

interface SkillDetails {
  slug: string;
  name: string;
  description: string;
  category: string;
  rating: number;
  install_command?: string;
  content: string;
}

export const findCommand = new Command('find')
  .description('Search and use a skill in one command')
  .argument('<query>', 'Search query')
  .action(async (query: string) => {
    const spinner = ora('Searching for skills...').start();

    try {
      const response = await apiRequest<SearchResponse>('/api/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });

      spinner.stop();

      if (!response.results || response.results.length === 0) {
        console.log(chalk.yellow('\nNo skills found matching your query.'));
        console.log(chalk.dim('Try different search terms or browse all skills at https://skillx.sh'));
        return;
      }

      // Display numbered results
      console.log(chalk.bold.green(`\n✓ Found ${response.total} skill(s)\n`));

      response.results.forEach((skill, i) => {
        const num = chalk.bold.white(`[${i + 1}]`);
        const name = chalk.cyan(skill.name);
        const category = chalk.magenta(skill.category);
        const rating = chalk.yellow(`⭐ ${skill.rating.toFixed(1)}`);
        console.log(`${num} ${name} ${category} ${rating}`);
        console.log(`    ${chalk.dim(truncate(skill.description, 80))}`);
      });

      console.log();

      // Prompt user to select
      const rl = readline.createInterface({ input, output });
      try {
        const answer = await rl.question(
          chalk.cyan(`Select a skill [1-${response.results.length}] or press Enter to cancel: `)
        );

        const choice = parseInt(answer.trim(), 10);
        if (isNaN(choice) || choice < 1 || choice > response.results.length) {
          console.log(chalk.dim('\nCancelled.'));
          return;
        }

        const selected = response.results[choice - 1];

        // Fetch and display full skill details
        const detailSpinner = ora(`Fetching ${selected.name}...`).start();
        const skill = await apiRequest<SkillDetails>(`/api/skills/${selected.slug}`);
        detailSpinner.stop();

        console.log(chalk.bold.green(`\n✓ Skill: ${skill.name}\n`));
        console.log(chalk.dim('─'.repeat(80)));
        console.log(chalk.bold('Description:'));
        console.log(skill.description);
        console.log();
        console.log(chalk.bold('Category:'), chalk.magenta(skill.category));
        console.log(chalk.bold('Rating:'), chalk.yellow(`⭐ ${skill.rating.toFixed(1)}`));
        console.log();

        if (skill.install_command) {
          console.log(chalk.bold.cyan('Install Command:'));
          console.log(chalk.bgBlack.white(` ${skill.install_command} `));
          console.log();
        }

        console.log(chalk.bold('Content Preview:'));
        console.log(chalk.dim('─'.repeat(80)));
        const preview = skill.content.split('\n').slice(0, 30).join('\n');
        console.log(preview);

        if (skill.content.split('\n').length > 30) {
          console.log(chalk.dim('\n... (content truncated)'));
        }

        console.log(chalk.dim('\n─'.repeat(80)));
        console.log(chalk.dim(`\nUse ${chalk.cyan(`skillx use ${skill.slug} --raw`)} to output full content`));
        console.log(chalk.dim(`View online at: ${chalk.underline(`https://skillx.sh/skills/${skill.slug}`)}`));
      } finally {
        rl.close();
      }
    } catch (error) {
      spinner.stop();

      if (error instanceof ApiError) {
        console.error(chalk.red(`\n✗ API Error: ${error.message}`));
      } else if (error instanceof Error) {
        console.error(chalk.red(`\n✗ Network Error: ${error.message}`));
        console.error(chalk.dim('Check your internet connection or try again later.'));
      } else {
        console.error(chalk.red('\n✗ An unexpected error occurred'));
      }
      process.exit(1);
    }
  });

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}
