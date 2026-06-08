#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { execSync } = require("node:child_process");
const readline = require("node:readline");
const https = require("node:https");

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

const COMMENT =
	"# fix-chrome-icons.js automatic cron job (managed by setup.js)";

function ask(question) {
	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			resolve(answer.trim());
		});
	});
}

function hasCommand(cmd) {
	try {
		execSync(`command -v ${cmd} 2>/dev/null`);
		return true;
	} catch {
		return false;
	}
}

function getBunPath() {
	try {
		return execSync("command -v bun 2>/dev/null", { encoding: "utf8" }).trim();
	} catch {
		return null;
	}
}

function getNodePath() {
	try {
		return execSync("command -v node 2>/dev/null", { encoding: "utf8" }).trim();
	} catch {
		return process.execPath;
	}
}

function checkKde() {
	const desktop = (process.env.XDG_CURRENT_DESKTOP || "").toLowerCase();
	const session = (process.env.DESKTOP_SESSION || "").toLowerCase();
	const isKde =
		desktop.includes("kde") ||
		desktop.includes("plasma") ||
		session.includes("kde") ||
		session.includes("plasma");

	if (!isKde) {
		console.log(
			`${COLORS.YELLOW}Warning: KDE Plasma was not detected as the current desktop environment.${COLORS.RESET}`,
		);
		console.log(
			`Detected desktop environment: ${process.env.XDG_CURRENT_DESKTOP || "Unknown"}\n`,
		);
		return new Promise((resolve) => {
			rl.question(
				"Do you want to continue with the setup anyway? (y/N): ",
				(answer) => {
					const response = answer.trim().toLowerCase();
					if (response !== "y" && response !== "yes") {
						console.log("Exiting setup.");
						rl.close();
						process.exit(0);
					}
					resolve();
				},
			);
		});
	}
	return Promise.resolve();
}

function downloadFile(url, destPath) {
	return new Promise((resolve, reject) => {
		function get(targetUrl) {
			https
				.get(targetUrl, (response) => {
					if (response.statusCode === 301 || response.statusCode === 302) {
						get(response.headers.location);
						return;
					}
					if (response.statusCode !== 200) {
						reject(
							new Error(
								`Failed to download file: Status Code ${response.statusCode}`,
							),
						);
						return;
					}
					const file = fs.createWriteStream(destPath);
					response.pipe(file);
					file.on("finish", () => {
						file.close();
						resolve();
					});
				})
				.on("error", (err) => {
					try {
						fs.unlinkSync(destPath);
					} catch {}
					reject(err);
				});
		}
		get(url);
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

function getCurrentCronConfig() {
	const crontab = getCrontab();
	if (!crontab.includes(COMMENT)) return null;

	const lines = crontab.split("\n");
	for (let i = 0; i < lines.length - 1; i++) {
		if (lines[i].trim() === COMMENT) {
			const nextLine = lines[i + 1].trim();
			if (nextLine && !nextLine.startsWith("#")) {
				const match = nextLine.match(/0\s+\*\/(\d+)\s+\*\s+\*\s+\*/);
				if (match) {
					const interval = parseInt(match[1], 10);
					return { interval };
				}
			}
			break;
		}
	}
	return null;
}

function getSystemdStatus() {
	const home = os.homedir();
	const pathFile = path.join(
		home,
		".config/systemd/user/fix-chrome-icons.path",
	);
	if (!fs.existsSync(pathFile)) return "not_installed";

	try {
		const isActive = execSync(
			"systemctl --user is-active fix-chrome-icons.path 2>/dev/null",
			{ encoding: "utf8" },
		).trim();
		return isActive === "active" ? "active" : "inactive";
	} catch {
		return "inactive";
	}
}

function setupSystemdWatcher(runtimePath, scriptPath) {
	const home = os.homedir();
	const systemdUserDir = path.join(home, ".config/systemd/user");
	fs.mkdirSync(systemdUserDir, { recursive: true });

	const serviceFile = path.join(systemdUserDir, "fix-chrome-icons.service");
	const pathFile = path.join(systemdUserDir, "fix-chrome-icons.path");

	const userPath =
		process.env.PATH ||
		"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";

	const serviceContent = `[Unit]
Description=Fix Chrome PWA Icons
After=default.target

[Service]
Type=oneshot
Environment="PATH=${userPath}"
ExecStart="${runtimePath}" "${scriptPath}"
`;

	const appsDir = path.join(home, ".local/share/applications");
	const pathContent = `[Unit]
Description=Watch ~/.local/share/applications for Chrome PWA changes

[Path]
PathChanged=${appsDir}
Unit=fix-chrome-icons.service

[Install]
WantedBy=paths.target
`;

	fs.writeFileSync(serviceFile, serviceContent);
	fs.writeFileSync(pathFile, pathContent);

	const systemctl = "systemctl --user";
	execSync(`${systemctl} daemon-reload`);
	execSync(`${systemctl} enable fix-chrome-icons.path`);
	execSync(`${systemctl} start fix-chrome-icons.path`);

	console.log(
		`${COLORS.GREEN}✓ Systemd File Watcher installed and started successfully!${COLORS.RESET}`,
	);
	console.log(`  Watching: ${appsDir}`);
}

function removeSystemdWatcher() {
	const home = os.homedir();
	const systemdUserDir = path.join(home, ".config/systemd/user");
	const serviceFile = path.join(systemdUserDir, "fix-chrome-icons.service");
	const pathFile = path.join(systemdUserDir, "fix-chrome-icons.path");

	let removed = false;
	if (fs.existsSync(pathFile)) {
		try {
			execSync("systemctl --user stop fix-chrome-icons.path 2>/dev/null");
			execSync("systemctl --user disable fix-chrome-icons.path 2>/dev/null");
		} catch {}
		try {
			fs.unlinkSync(pathFile);
			removed = true;
		} catch {}
	}
	if (fs.existsSync(serviceFile)) {
		try {
			fs.unlinkSync(serviceFile);
			removed = true;
		} catch {}
	}
	if (removed) {
		try {
			execSync("systemctl --user daemon-reload 2>/dev/null");
		} catch {}
		console.log(
			`${COLORS.GREEN}✓ Systemd File Watcher removed successfully!${COLORS.RESET}`,
		);
	}
}

function setupCronJob(runtimePath, scriptPath, interval) {
	let crontab = getCrontab();
	crontab = removeCronJob(crontab, COMMENT);

	const schedule = `0 */${interval} * * *`;
	const userPath =
		process.env.PATH ||
		"/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
	const command = `PATH=${userPath} "${runtimePath}" "${scriptPath}" > /dev/null 2>&1`;
	const cronLine = `${schedule} ${command}`;

	const newCrontab = `${crontab + (crontab ? "\n" : "")}${COMMENT}\n${cronLine}\n`;
	setCrontab(newCrontab);

	console.log(
		`${COLORS.GREEN}✓ Cron job installed successfully (runs every ${interval} hours)!${COLORS.RESET}`,
	);
}

function removeCronJobSetup() {
	let crontab = getCrontab();
	if (crontab.includes(COMMENT)) {
		crontab = removeCronJob(crontab, COMMENT);
		setCrontab(crontab);
		console.log(
			`${COLORS.GREEN}✓ Cron job removed successfully!${COLORS.RESET}`,
		);
	}
}

async function cleanExistingAutomation() {
	// Removes either systemd or cron settings to prevent duplicate runs
	removeSystemdWatcher();
	let crontab = getCrontab();
	if (crontab.includes(COMMENT)) {
		crontab = removeCronJob(crontab, COMMENT);
		setCrontab(crontab);
	}
}

async function removeAllSetups(installDir) {
	console.log(`\n${COLORS.YELLOW}Removing all setups...${COLORS.RESET}`);
	removeSystemdWatcher();
	removeCronJobSetup();

	const destScriptPath = path.join(installDir, "fix-chrome-icons.js");
	if (fs.existsSync(destScriptPath)) {
		try {
			fs.unlinkSync(destScriptPath);
			console.log(
				`${COLORS.GREEN}✓ Removed script: ${destScriptPath}${COLORS.RESET}`,
			);
		} catch (err) {
			console.error(`Failed to remove script file: ${err.message}`);
		}
	}
	if (fs.existsSync(installDir)) {
		try {
			fs.rmdirSync(installDir);
			console.log(
				`${COLORS.GREEN}✓ Removed folder: ${installDir}${COLORS.RESET}`,
			);
		} catch (err) {
			// Directory might not be empty if there are backups or other files
			console.log(
				`${COLORS.YELLOW}Note: Installation folder ${installDir} not deleted because it is not empty.${COLORS.RESET}`,
			);
		}
	}
	console.log(`\n${COLORS.GREEN}Uninstallation complete!${COLORS.RESET}`);
}

async function main() {
	console.log(
		`${COLORS.CYAN}=== fix-chrome-icons Setup ===${COLORS.RESET}\n`,
	);

	// 1. Check KDE desktop environment
	await checkKde();

	// 2. Check dependencies
	const hasSystemd = hasCommand("systemctl");
	const hasCrontab = hasCommand("crontab");
	const bunPath = getBunPath();
	const nodePath = getNodePath();

	if (!hasSystemd && !hasCrontab) {
		console.error(
			`${COLORS.RED}Error: Neither systemd nor crontab is available on this system. Cannot configure automation.${COLORS.RESET}`,
		);
		rl.close();
		process.exit(1);
	}

	const home = os.homedir();
	const defaultInstallDir = path.join(home, ".local/share/fix-chrome-icons");
	let installDir = defaultInstallDir;

	// Check status
	const cronConfig = getCurrentCronConfig();
	const systemdActive = getSystemdStatus();

	console.log(`${COLORS.CYAN}Current configuration status:${COLORS.RESET}`);
	console.log(
		`- Cron Job: ${cronConfig ? `${COLORS.GREEN}Installed (every ${cronConfig.interval} hours)${COLORS.RESET}` : `${COLORS.RED}Not installed${COLORS.RESET}`}`,
	);
	if (hasSystemd) {
		let systemdStatusStr = `${COLORS.RED}Not installed${COLORS.RESET}`;
		if (systemdActive === "active") {
			systemdStatusStr = `${COLORS.GREEN}Installed & Active (Watching ~/.local/share/applications)${COLORS.RESET}`;
		} else if (systemdActive === "inactive") {
			systemdStatusStr = `${COLORS.YELLOW}Installed but Inactive/Disabled${COLORS.RESET}`;
		}
		console.log(`- File Watcher (systemd): ${systemdStatusStr}`);
	} else {
		console.log(
			`- File Watcher (systemd): ${COLORS.YELLOW}Not supported (systemd not found)${COLORS.RESET}`,
		);
	}
	console.log();

	const action = await ask(
		"What would you like to do?\n" +
			"1. Install or update (Default - Bun/Node & Cron)\n" +
			"2. Custom Install/Update (Choose runtime, directory, file watcher/cron)\n" +
			"3. Remove/Uninstall all setups\n" +
			"4. Exit\n" +
			"Enter choice (1-4): ",
	);

	if (action === "4") {
		console.log("Goodbye!");
		rl.close();
		process.exit(0);
	}

	if (action === "3") {
		await removeAllSetups(installDir);
		rl.close();
		process.exit(0);
	}

	let selectedRuntime = bunPath ? "bun" : "node";
	let selectedRuntimePath = bunPath || nodePath;
	let selectedAutomation = "cron"; // default
	let cronInterval = 2; // default (hours)

	if (action === "2") {
		// Custom Setup flow
		console.log(`\n${COLORS.MAGENTA}=== Custom Setup ===${COLORS.RESET}`);

		// 2a. Choose runtime
		console.log("\nSelect Runtime:");
		if (bunPath) console.log(`1. Bun (${bunPath}) - recommended`);
		else
			console.log(`1. Bun (Not found - choose option 3 to specify custom path)`);
		console.log(`2. Node.js (${nodePath})`);
		console.log(`3. Specify custom executable path`);
		const runtimeChoice = await ask("Enter choice (1-3, default 1): ");
		if (runtimeChoice === "2") {
			selectedRuntime = "node";
			selectedRuntimePath = nodePath;
		} else if (runtimeChoice === "3") {
			const customPath = await ask(
				"Enter custom runtime executable absolute path: ",
			);
			if (!fs.existsSync(customPath)) {
				console.error(
					`${COLORS.RED}Error: File does not exist at ${customPath}.${COLORS.RESET}`,
				);
				rl.close();
				process.exit(1);
			}
			selectedRuntimePath = customPath;
			selectedRuntime = path.basename(customPath);
		} else {
			if (!bunPath) {
				console.warn(
					`${COLORS.YELLOW}Warning: Bun not found. Falling back to Node.js (${nodePath})${COLORS.RESET}`,
				);
				selectedRuntime = "node";
				selectedRuntimePath = nodePath;
			} else {
				selectedRuntime = "bun";
				selectedRuntimePath = bunPath;
			}
		}

		// 2b. Choose directory
		const customDir = await ask(
			`\nEnter installation directory (default: ${defaultInstallDir}): `,
		);
		if (customDir) {
			installDir = path.resolve(customDir.replace(/^~/, home));
		}

		// 2c. Choose automation
		console.log("\nSelect Automation Method:");
		let optIndex = 1;
		const opts = [];
		if (hasSystemd) {
			console.log(
				`${optIndex}. File Watcher (systemd path unit - real-time, recommended)`,
			);
			opts.push("watcher");
			optIndex++;
		}
		if (hasCrontab) {
			console.log(`${optIndex}. Cron Job (scheduled intervals)`);
			opts.push("cron");
			optIndex++;
		}
		if (hasSystemd && hasCrontab) {
			console.log(`${optIndex}. Both File Watcher and Cron Job`);
			opts.push("both");
			optIndex++;
		}
		console.log(`${optIndex}. None (Manual execution only)`);
		opts.push("none");

		const autoChoice =
			parseInt(await ask(`Enter choice (1-${optIndex}, default 1): `), 10) || 1;
		selectedAutomation = opts[autoChoice - 1] || "watcher";

		if (selectedAutomation === "cron" || selectedAutomation === "both") {
			const freq = await ask(
				"\nHow often should the cron job run?\n" +
					"1. Every 2 hours\n" +
					"2. Every 4 hours\n" +
					"3. Every 6 hours (recommended)\n" +
					"4. Every 12 hours\n" +
					`Enter choice (1-4, default 3): `,
			);
			switch (freq) {
				case "1":
					cronInterval = 2;
					break;
				case "2":
					cronInterval = 4;
					break;
				case "3":
					cronInterval = 6;
					break;
				case "4":
					cronInterval = 12;
					break;
				default:
					cronInterval = 6;
			}
		}
	} else if (action === "1") {
		// Default Installation
		console.log(
			`\n${COLORS.YELLOW}Installing with default configuration...${COLORS.RESET}`,
		);
		if (!bunPath) {
			console.log(`Bun not found. Using Node.js (${nodePath}) as fallback.`);
		}
	} else {
		console.error(`${COLORS.RED}Invalid choice.${COLORS.RESET}`);
		rl.close();
		process.exit(1);
	}

	// 3. Perform Installation
	try {
		// Ensure install dir exists
		fs.mkdirSync(installDir, { recursive: true });

		const destScriptPath = path.join(installDir, "fix-chrome-icons.js");
		const localScriptPath = path.join(__dirname, "fix-chrome-icons.js");

		if (fs.existsSync(localScriptPath)) {
			// Copy from local folder
			fs.copyFileSync(localScriptPath, destScriptPath);
			console.log(
				`\n${COLORS.GREEN}✓ Copied script to ${destScriptPath}${COLORS.RESET}`,
			);
		} else {
			// Download from GitHub
			console.log(`\nDownloading fix-chrome-icons.js from GitHub raw...`);
			const rawUrl =
				"https://raw.githubusercontent.com/wkdkavishka/fix-chrome-PWA-icons-linux/master/fix-chrome-icons.js";
			await downloadFile(rawUrl, destScriptPath);
			console.log(
				`${COLORS.GREEN}✓ Successfully downloaded script to ${destScriptPath}${COLORS.RESET}`,
			);
		}

		// Make executable
		fs.chmodSync(destScriptPath, "755");

		// Remove old installations if updating to avoid conflicts
		await cleanExistingAutomation();

		// 4. Configure Automation
		if (selectedAutomation === "watcher" || selectedAutomation === "both") {
			setupSystemdWatcher(selectedRuntimePath, destScriptPath);
		}
		if (selectedAutomation === "cron" || selectedAutomation === "both") {
			setupCronJob(selectedRuntimePath, destScriptPath, cronInterval);
		}
		if (selectedAutomation === "none") {
			console.log(
				`\n${COLORS.YELLOW}No automation configured. You can run the script manually:${COLORS.RESET}`,
			);
			console.log(
				`${COLORS.CYAN}"${selectedRuntimePath}" "${destScriptPath}"${COLORS.RESET}`,
			);
		}

		console.log(
			`\n${COLORS.GREEN}Setup completed successfully!${COLORS.RESET}`,
		);
	} catch (err) {
		console.error(
			`\n${COLORS.RED}Error during setup: ${err.message}${COLORS.RESET}`,
		);
	}

	rl.close();
}

main().catch((err) => {
	console.error("Unexpected error:", err);
	rl.close();
	process.exit(1);
});
