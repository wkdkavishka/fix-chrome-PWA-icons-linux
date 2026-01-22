#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");
const readline = require("node:readline");

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const COLORS = {
	CYAN: "\x1b[36m",
	GREEN: "\x1b[32m",
	YELLOW: "\x1b[33m",
	MAGENTA: "\x1b[35m",
	RED: "\x1b[31m",
	BLUE: "\x1b[34m",
	RESET: "\x1b[0m",
};

// Moved here so it's accessible to all functions
const COMMENT =
	"# fix-chrome-icons.js automatic cron job (managed by setup.js)";

function ask(question) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer.trim());
		});
	});
}

function getCrontab() {
	try {
		return execSync("crontab -l 2>/dev/null", { encoding: "utf8" }) || "";
	} catch {
		return "";
	}
}

function setCrontab(content) {
	const tempPath = path.join(os.tmpdir(), `crontab-setup-${process.pid}.tmp`);
	try {
		fs.writeFileSync(tempPath, content);
		execSync(`crontab "${tempPath}"`);
	} catch (err) {
		console.error("Failed to update crontab:", err.message);
		process.exit(1);
	} finally {
		try {
			fs.unlinkSync(tempPath);
		} catch {}
	}
}

function removeCronJob(crontabContent, comment) {
	const lines = crontabContent.split("\n");
	const newLines = [];
	let skipNext = false;

	for (const line of lines) {
		if (skipNext) {
			skipNext = false;
			continue;
		}
		if (line.trim() === comment) {
			skipNext = true;
			continue;
		}
		newLines.push(line);
	}

	return newLines.join("\n") + (newLines.length > 0 ? "\n" : "");
}

function getCurrentConfig() {
	const crontab = getCrontab();
	if (!crontab.includes(COMMENT)) return null;

	const lines = crontab.split("\n");
	for (let i = 0; i < lines.length - 1; i++) {
		if (lines[i].trim() === COMMENT) {
			const nextLine = lines[i + 1].trim();
			if (nextLine && !nextLine.startsWith("#")) {
				const parts = nextLine.split(/\s+/);
				if (
					parts.length >= 6 &&
					parts[0] === "0" &&
					parts[1].startsWith("*/")
				) {
					const interval = parseInt(parts[1].slice(2), 10);
					if ([2, 4, 6, 12].includes(interval)) {
						return { interval, schedule: parts.slice(0, 5).join(" ") };
					}
				}
			}
			break;
		}
	}
	return null;
}

async function main() {
	console.log(
		`${COLORS.CYAN}=== fix-chrome-icons Cron Job Setup ===${COLORS.RESET}\n`,
	);
	console.log(
		"This interactive script will install, update, or remove a cron job",
	);
	console.log(
		"that runs fix-chrome-icons.js a few times per day using node.\n",
	);

	const scriptDir = __dirname;
	const scriptPath = path.resolve(scriptDir, "fix-chrome-icons.js");

	if (!fs.existsSync(scriptPath)) {
		console.error(
			`${COLORS.RED}Error:${COLORS.RESET} fix-chrome-icons.js not found in the current directory.`,
		);
		console.error(
			"Make sure this setup script is in the same folder as fix-chrome-icons.js.",
		);
		rl.close();
		process.exit(1);
	}

	while (true) {
		console.log(
			`${COLORS.MAGENTA}----------------------------------------${COLORS.RESET}`,
		);

		const currentConfig = getCurrentConfig();

		const statusText = currentConfig
			? `${COLORS.GREEN}Installed${COLORS.RESET}`
			: `${COLORS.RED}Not installed${COLORS.RESET}`;

		const details = currentConfig
			? `${COLORS.YELLOW} (every ${currentConfig.interval} hours)${COLORS.RESET}`
			: "";

		console.log(`Current status: ${statusText}${details}\n`);

		const action = await ask(
			"What would you like to do?\n" +
				"1. Install or update cron job\n" +
				"2. Remove cron job\n" +
				"3. Exit\n" +
				"Enter choice (1-3): ",
		);

		if (action === "3") {
			console.log("\nGoodbye!");
			break;
		}

		if (action === "1") {
			let crontab = getCrontab();
			let existing = false;

			if (currentConfig) {
				existing = true;
				crontab = removeCronJob(crontab, COMMENT);
				console.log(
					`${COLORS.YELLOW}Replacing existing cron job...${COLORS.RESET}\n`,
				);
			} else {
				console.log(
					`${COLORS.YELLOW}Installing new cron job...${COLORS.RESET}\n`,
				);
			}

			let defaultChoice = "3";
			if (currentConfig) {
				switch (currentConfig.interval) {
					case 2:
						defaultChoice = "1";
						break;
					case 4:
						defaultChoice = "2";
						break;
					case 6:
						defaultChoice = "3";
						break;
					case 12:
						defaultChoice = "4";
						break;
				}
				console.log(
					`Current setting: every ${currentConfig.interval} hours (option ${defaultChoice})\n`,
				);
			}

			const freq =
				(await ask(
					"How often should the script run? (a few times per day)\n" +
						"1. Every 2 hours  (12×/day)\n" +
						"2. Every 4 hours  (6×/day)\n" +
						"3. Every 6 hours  (4×/day) – recommended\n" +
						"4. Every 12 hours (2×/day)\n" +
						`Enter choice (1-4, default ${defaultChoice}): `,
				)) || defaultChoice;

			let interval;
			switch (freq) {
				case "1":
					interval = 2;
					break;
				case "2":
					interval = 4;
					break;
				case "3":
					interval = 6;
					break;
				case "4":
					interval = 12;
					break;
				default:
					interval = 6;
			}

			const schedule = `0 */${interval} * * *`;
			const command = `node "${scriptPath}" > /dev/null 2>&1`;
			const cronLine = `${schedule} ${command}`;

			const newCrontab = `${crontab + (crontab ? "\n" : "")}${COMMENT}\n${cronLine}\n`;

			setCrontab(newCrontab);

			console.log(
				`\n${COLORS.GREEN}✓ Cron job successfully ${existing ? "updated" : "installed"}!${COLORS.RESET}`,
			);
			console.log(
				`${COLORS.GREEN}  The script will now run every ${interval} hours (at :00).${COLORS.RESET}`,
			);
			console.log(`${COLORS.CYAN}  Schedule: ${schedule}${COLORS.RESET}\n`);
		} else if (action === "2") {
			if (!currentConfig) {
				console.log(
					`${COLORS.YELLOW}No cron job found to remove.${COLORS.RESET}\n`,
				);
				continue;
			}

			let crontab = getCrontab();
			crontab = removeCronJob(crontab, COMMENT);
			setCrontab(crontab);

			console.log(
				`\n${COLORS.GREEN}✓ Cron job successfully removed!${COLORS.RESET}\n`,
			);
		} else {
			console.log(
				`${COLORS.RED}Invalid choice – please try again.${COLORS.RESET}\n`,
			);
		}
	}

	rl.close();
}

main().catch((err) => {
	console.error("Unexpected error:", err);
	rl.close();
	process.exit(1);
});
