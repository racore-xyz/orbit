#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const skillsRoot = path.join(__dirname, 'skills');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
);

const skills = [
  {
    name: 'awwwards-hero',
    category: 'Frontend',
    description: 'Award-quality hero sections with Arabic and RTL architectures.',
  },
  {
    name: 'awwwards-sections',
    category: 'Frontend',
    description: 'Premium below-the-fold landing page sections.',
  },
  {
    name: 'awwwards-motion',
    category: 'Motion',
    description: 'Scroll choreography, transitions, and Arabic-safe kinetic type.',
  },
  {
    name: 'pixel-perfect',
    category: 'Frontend',
    description: 'Screenshot-to-code replication with RTL and bidi extraction.',
  },
  {
    name: 'visual-redesign',
    category: 'Redesign',
    description: 'Non-destructive visual upgrades for existing applications.',
  },
  {
    name: 'imagegen-frontend',
    category: 'Image generation',
    description: 'Arabic-first website mockups and section reference images.',
  },
  {
    name: 'brandkit-gen',
    category: 'Image generation',
    description: 'Brand boards, logo systems, and Arabic/Latin identity lockups.',
  },
];

const skillNames = new Set(skills.map((skill) => skill.name));

function printBanner() {
  console.log(
    chalk.cyan.bold(`
   A R A B I A N   C U R B
   Arabic-first design skills for AI agents
`),
  );
}

function printHelp() {
  printBanner();
  console.log(`${chalk.bold('Usage:')}
  arabiancurb                         Open the interactive installer
  arabiancurb list                    List available skills
  arabiancurb add <skill...>          Install one or more skills
  arabiancurb add --all               Install all skills

${chalk.bold('Options:')}
  -t, --target <directory>            Installation root (default: .agents/skills)
      --dry-run                       Show what would be installed
  -h, --help                          Show this help
  -v, --version                       Show the package version

${chalk.bold('Examples:')}
  npx arabiancurb
  npx arabiancurb list
  npx arabiancurb add awwwards-hero
  npx arabiancurb add awwwards-hero awwwards-motion
  npx arabiancurb add --all --target .agents/skills
`);
}

function printSkills() {
  printBanner();
  const widestName = Math.max(...skills.map((skill) => skill.name.length));
  const widestCategory = Math.max(...skills.map((skill) => skill.category.length));

  for (const skill of skills) {
    console.log(
      `${chalk.cyan(skill.name.padEnd(widestName))}  ` +
        `${chalk.gray(skill.category.padEnd(widestCategory))}  ` +
        skill.description,
    );
  }
}

function readOption(args, longName, shortName) {
  const longIndex = args.indexOf(longName);
  const shortIndex = shortName ? args.indexOf(shortName) : -1;
  const index = longIndex >= 0 ? longIndex : shortIndex;

  if (index < 0) {
    return undefined;
  }

  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${longName} requires a directory value.`);
  }

  return value;
}

function resolveTarget(args) {
  const requested = readOption(args, '--target', '-t');
  return path.resolve(process.cwd(), requested ?? path.join('.agents', 'skills'));
}

function installSkills(selectedNames, targetRoot, { dryRun = false } = {}) {
  const unknown = selectedNames.filter((name) => !skillNames.has(name));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown skill${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. ` +
        'Run "arabiancurb list" to see valid names.',
    );
  }

  if (selectedNames.length === 0) {
    throw new Error('Choose at least one skill or use --all.');
  }

  if (dryRun) {
    console.log(chalk.yellow(`Dry run. Target: ${targetRoot}`));
    for (const name of selectedNames) {
      console.log(`  ${chalk.cyan(name)} -> ${path.join(targetRoot, name)}`);
    }
    return;
  }

  fs.mkdirSync(targetRoot, { recursive: true });
  const spinner = ora(`Installing ${selectedNames.length} skill(s)...`).start();

  try {
    for (const name of selectedNames) {
      const source = path.join(skillsRoot, name);
      const destination = path.join(targetRoot, name);

      if (!fs.existsSync(path.join(source, 'SKILL.md'))) {
        throw new Error(`Packaged skill is incomplete: ${name}`);
      }

      fs.cpSync(source, destination, { recursive: true, force: true });
    }

    spinner.succeed(
      `Installed ${selectedNames.length} skill(s) to ${targetRoot}`,
    );
    console.log(
      chalk.gray('Each skill includes its conditional Arabic Mode reference.'),
    );
  } catch (error) {
    spinner.fail('Installation failed.');
    throw error;
  }
}

async function runInteractive(args) {
  printBanner();
  const targetRoot = resolveTarget(args);
  const dryRun = args.includes('--dry-run');
  const answers = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'skills',
      message: 'Select the skills to install:',
      pageSize: skills.length,
      choices: skills.map((skill) => ({
        name: `${skill.name} - ${skill.description}`,
        value: skill.name,
      })),
      validate: (value) => value.length > 0 || 'Select at least one skill.',
    },
  ]);

  installSkills(answers.skills, targetRoot, { dryRun });
}

function parseAddSelection(args) {
  if (args.includes('--all')) {
    return skills.map((skill) => skill.name);
  }

  const optionNames = new Set(['--target', '-t']);
  const selected = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (optionNames.has(value)) {
      index += 1;
      continue;
    }
    if (value === '--dry-run') {
      continue;
    }
    if (value.startsWith('-')) {
      throw new Error(`Unknown option: ${value}`);
    }
    selected.push(value);
  }

  return [...new Set(selected)];
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (args.includes('--version') || args.includes('-v')) {
    console.log(packageJson.version);
    return;
  }

  if (args.includes('--help') || args.includes('-h') || command === 'help') {
    printHelp();
    return;
  }

  if (!command || command.startsWith('-')) {
    await runInteractive(args);
    return;
  }

  if (command === 'list' || command === 'ls') {
    printSkills();
    return;
  }

  if (command === 'add' || command === 'install') {
    const commandArgs = args.slice(1);
    const targetRoot = resolveTarget(commandArgs);
    const selected = parseAddSelection(commandArgs);
    installSkills(selected, targetRoot, {
      dryRun: commandArgs.includes('--dry-run'),
    });
    return;
  }

  throw new Error(
    `Unknown command: ${command}. Run "arabiancurb --help" for usage.`,
  );
}

main().catch((error) => {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exitCode = 1;
});
