#!/usr/bin/env bun

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Color variables for consistent output formatting
const COLORS = {
	CYAN: "\x1b[36m",
	GREEN: "\x1b[32m",
	YELLOW: "\x1b[33m",
	MAGENTA: "\x1b[35m",
	RED: "\x1b[31m",
	BLUE: "\x1b[34m",
	RESET: "\x1b[0m",
} as const;

async function findFiles(dir: string, pattern: RegExp): Promise<string[]> {
	const files: string[] = [];

	async function walk(currentDir: string) {
		const entries = await fs.readdir(currentDir, { withFileTypes: true });
		for (const entry of entries) {
			const fullPath = path.join(currentDir, entry.name);
			if (entry.isDirectory()) {
				await walk(fullPath);
			} else if (pattern.test(entry.name)) {
				files.push(fullPath);
			}
		}
	}

	await walk(dir);
	return files;
}

async function main() {
	const home = os.homedir();

	// Configuration
	const APPS_DIR = path.join(home, ".local/share/applications");
	const ICONS_DIR = path.join(home, ".local/share/icons/hicolor/256x256/apps");
	const BACKUP_DIR = path.join(home, ".local/share/applications/backups");

	// Create backup directory
	try {
		await fs.mkdir(BACKUP_DIR, { recursive: true });
	} catch (_err) {
		console.error("Error: Failed to create backup directory");
		process.exit(1);
	}

	// Find all Chrome desktop files
	const fileList = await findFiles(APPS_DIR, /^chrome-.*\.desktop$/);

	console.log(`${COLORS.CYAN}%s${COLORS.RESET}`, "Found File List: ");
	if (fileList.length === 0) {
		console.log("No Chrome desktop files found");
		process.exit(0);
	} else {
		fileList.forEach((file) => {
			console.log(`${COLORS.YELLOW}%s${COLORS.RESET}`, file);
		});
	}
	console.log(
		`${COLORS.CYAN}%s${COLORS.RESET}`,
		`Found ${fileList.length} Chrome desktop files to process`,
	);

	// Initialize counters
	let processed = 0;
	let updated = 0;
	let errors = 0;

	// Process each file
	for (const file of fileList) {
		console.log(
			`${COLORS.MAGENTA}%s${COLORS.RESET}`,
			`Processing: ${path.basename(file)}`,
		);

		const filename = path.basename(file);
		const parts = filename.replace(".desktop", "").split("-");

		// parts should be exactly 3: chrome, app_id, profile
		if (parts.length !== 3) {
			console.log(
				`${COLORS.RED}%s${COLORS.RESET}`,
				"  ✗ Invalid filename format, skipping",
			);
			errors++;
			continue;
		}

		const app_id = parts[1];
		const profile = parts[2];
		const icon_name = `chrome-${app_id}-${profile}`;
		const icon_path = path.join(ICONS_DIR, `${icon_name}.png`);

		const backup_file = path.join(BACKUP_DIR, `${filename}.bak`);

		// Create backup
		let backupSuccess = false;
		try {
			await fs.copyFile(file, backup_file);
			console.log(
				`${COLORS.GREEN}%s${COLORS.RESET}`,
				`  ✓ Backup created: ${path.basename(backup_file)}`,
			);
			backupSuccess = true;
		} catch (_err) {
			console.log(
				`${COLORS.RED}%s${COLORS.RESET}`,
				`  ✗ Backup failed, skipping file`,
			);
			errors++;
			continue;
		}

		// Update icon path if backup succeeded
		if (backupSuccess) {
			try {
				const content = await fs.readFile(file, "utf-8");
				const newContent = content.replace(/^Icon=.*$/gm, `Icon=${icon_path}`);
				await fs.writeFile(file, newContent);
				console.log(
					`${COLORS.GREEN}%s${COLORS.RESET}`,
					`  ✓ Updated icon path to: ${icon_path}`,
				);
				updated++;
			} catch (_err) {
				console.log(
					`${COLORS.RED}%s${COLORS.RESET}`,
					"  ✗ Failed to update icon path",
				);
				errors++;
			}

			processed++;
		}

		console.log(""); // Empty line between files
	}

	// Print summary
	console.log(`${COLORS.BLUE}%s${COLORS.RESET}`, "=== Summary ===");
	console.log(
		`${COLORS.GREEN}%s${COLORS.RESET}`,
		`Processed: ${processed} files`,
	);
	console.log(`${COLORS.GREEN}%s${COLORS.RESET}`, `Updated: ${updated} files`);
	console.log(`${COLORS.RED}%s${COLORS.RESET}`, `Errors: ${errors}`);

	if (updated > 0) {
		console.log(
			`${COLORS.YELLOW}%s${COLORS.RESET}`,
			`Backups saved in: ${BACKUP_DIR}`,
		);
	}

	console.log(`${COLORS.GREEN}%s${COLORS.RESET}`, "Done!");
}

main().catch((err) => {
	console.error("Unexpected error:", err);
	process.exit(1);
});
