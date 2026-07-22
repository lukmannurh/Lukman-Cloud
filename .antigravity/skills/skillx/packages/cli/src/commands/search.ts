import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ApiError } from '../lib/api-client.js';
import { searchSkills } from '../lib/search-api.js';
import { resolveAndUseSkill } from './use.js';

export const searchCommand = new Command('search')
  .description('Search for skills in the SkillX marketplace')
  .argument('<query>', 'Search query')
  .option('-u, --use', 'Auto-pick the top result and show its details')
  .action(async (query: string, options: { use?: boolean }) => {
    const spinner = ora('Searching for skills...').start();

    try {
      const results = await searchSkills(query);
      spinner.stop();

      if (results.length === 0) {
        console.log(chalk.yellow('\nNo skills found matching your query.'));
        console.log(chalk.dim('Try different search terms or browse all skills at https://skillx.sh'));
        return;
      }

      // --use flag: auto-pick top result and show details
      if (options.use) {
        const top = results[0];
        console.log(chalk.dim(`Top result for "${query}": ${chalk.cyan(`${top.author}/${top.name}`)}\n`));
        await resolveAndUseSkill(`${top.author}/${top.name}`, { raw: false });
        return;
      }

      console.log(chalk.bold.green(`\n✓ Found ${results.length} skill(s)\n`));

      const colWidths = { skill: 40, category: 15, rating: 8, description: 40 };

      console.log(
        chalk.bold(
          `${padRight('SKILL', colWidths.skill)} ${padRight('CATEGORY', colWidths.category)} ${padRight('RATING', colWidths.rating)} DESCRIPTION`
        )
      );
      console.log(chalk.dim('─'.repeat(105)));

      results.forEach((skill) => {
        const displayId = `${skill.author}/${skill.name}`;
        const skillCol = chalk.cyan(padRight(displayId, colWidths.skill));
        const categoryCol = chalk.magenta(padRight(skill.category, colWidths.category));
        const rating = skill.avg_rating ?? 0;
        const ratingCol = chalk.yellow(padRight(`⭐ ${rating.toFixed(1)}`, colWidths.rating));
        const descCol = truncate(skill.description, colWidths.description);

        console.log(`${skillCol} ${categoryCol} ${ratingCol} ${descCol}`);
      });

      console.log(chalk.dim(`\nUse ${chalk.cyan('skillx use <slug>')} to view and install a skill`));
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

function padRight(str: string, width: number): string {
  return str.length >= width ? str.substring(0, width - 3) + '...' : str.padEnd(width);
}

function truncate(str: string, maxLen: number): string {
  return str.length > maxLen ? str.substring(0, maxLen - 3) + '...' : str;
}
