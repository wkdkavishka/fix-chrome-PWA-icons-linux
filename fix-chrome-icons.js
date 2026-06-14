#!/usr/bin/env node

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

// Color variables for consistent output formatting
const COLORS = {
	CYAN: "\x1b[36m",
	GREEN: "\x1b[32m",
	YELLOW: "\x1b[33m",
	MAGENTA: "\x1b[35m",
	RED: "\x1b[31m",
	BLUE: "\x1b[34m",
	RESET: "\x1b[0m",
};

// CLI flags
const args = process.argv.slice(2);
const IS_QUIET = args.includes('--quiet') || !process.stdout.isTTY;

function log(color, message) {
	if (IS_QUIET) {
		const level = color === COLORS.RED ? '[ERROR]' :
					  color === COLORS.YELLOW ? '[WARN]' : '[INFO]';
		console.log(`${level} ${message}`);
	} else {
		console.log(`${color}%s${COLORS.RESET}`, message);
	}
}

async function findFiles(dir, pattern) {
	const files = [];

	async function walk(currentDir) {
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
	const HICOLOR_DIR = path.join(home, ".local/share/icons/hicolor");

	// Create backup directory
	try {
		await fs.mkdir(BACKUP_DIR, { recursive: true });
	} catch (_err) {
		console.error("Error: Failed to create backup directory");
		process.exit(1);
	}

	// Find all Chrome desktop files
	const fileList = await findFiles(APPS_DIR, /^chrome-.*\.desktop$/);

	log(COLORS.CYAN, "Found File List: ");
	if (fileList.length === 0) {
		console.log("No Chrome desktop files found");
		process.exit(0);
	} else {
		fileList.forEach((file) => {
			log(COLORS.YELLOW, file);
		});
	}
	log(
		COLORS.CYAN,
		`Found ${fileList.length} Chrome desktop files to process`,
	);

	// Initialize counters
	let processed = 0;
	let updated = 0;
	let errors = 0;

	// Process each file
	for (const file of fileList) {
		log(
			COLORS.MAGENTA,
			`Processing: ${path.basename(file)}`,
		);

		const filename = path.basename(file);
		const parts = filename.replace(".desktop", "").split("-");

		// parts should be exactly 3: chrome, app_id, profile
		if (parts.length !== 3) {
			log(
				COLORS.RED,
				"  ✗ Invalid filename format, skipping",
			);
			errors++;
			continue;
		}

		const app_id = parts[1];
		const profile = parts[2];
		const icon_name = `chrome-${app_id}-${profile}`;
		const icon_path = path.join(ICONS_DIR, `${icon_name}.png`);

		let content;
		try {
			content = await fs.readFile(file, "utf-8");
		} catch (_err) {
			log(
				COLORS.RED,
				`  ✗ Failed to read file, skipping`,
			);
			errors++;
			continue;
		}

		const newContent = content.replace(/^Icon=.*$/gm, `Icon=${icon_path}`);
		if (newContent === content) {
			log(
				COLORS.GREEN,
				`  ✓ Icon path is already correct: ${icon_path}`,
			);
			processed++;
			console.log(""); // Empty line between files
			continue;
		}

		const backup_file = path.join(BACKUP_DIR, `${filename}.bak`);

		// Create backup
		let backupSuccess = false;
		try {
			await fs.copyFile(file, backup_file);
			log(
				COLORS.GREEN,
				`  ✓ Backup created: ${path.basename(backup_file)}`,
			);
			backupSuccess = true;
		} catch (_err) {
			log(
				COLORS.RED,
				`  ✗ Backup failed, skipping file`,
			);
			errors++;
			continue;
		}

		// Update icon path if backup succeeded
		if (backupSuccess) {
			try {
				await fs.writeFile(file, newContent);
				log(
					COLORS.GREEN,
					`  ✓ Updated icon path to: ${icon_path}`,
				);
				updated++;
			} catch (_err) {
				log(
					COLORS.RED,
					"  ✗ Failed to update icon path",
				);
				errors++;
			}

			processed++;
		}

		console.log(""); // Empty line between files
	}

	// Print summary
	log(COLORS.BLUE, "=== Summary ===");
	log(
		COLORS.GREEN,
		`Processed: ${processed} files`,
	);
	log(COLORS.GREEN, `Updated: ${updated} files`);
	log(COLORS.RED, `Errors: ${errors}`);

	if (updated > 0) {
		log(
			COLORS.YELLOW,
			`Backups saved in: ${BACKUP_DIR}`,
		);
	}

	// Update KDE icon cache to refresh icon cache
	log(
		COLORS.YELLOW,
		"Updating KDE icon cache...",
	);
	try {
		const { execSync } = require("node:child_process");
		execSync(`update-desktop-database "${APPS_DIR}"`, {
			stdio: IS_QUIET ? "pipe" : "inherit",
		});
		log(
			COLORS.GREEN,
			"✓ KDE icon cache updated successfully",
		);
	} catch (_err) {
		log(
			COLORS.RED,
			"✗ Failed to update KDE icon cache",
		);
	}

	// Update GTK icon cache
	log(
		COLORS.YELLOW,
		"Updating GTK icon cache...",
	);
	try {
		const { execSync } = require("node:child_process");
		execSync(`gtk-update-icon-cache "${HICOLOR_DIR}"`, {
			stdio: IS_QUIET ? "pipe" : "inherit",
		});
		log(
			COLORS.GREEN,
			"✓ GTK icon cache updated successfully",
		);
	} catch (_err) {
		log(
			COLORS.RED,
			"✗ Failed to update GTK icon cache",
		);
	}

	log(COLORS.GREEN, "Done!");
}

main().catch((err) => {
	console.error("Unexpected error:", err);
	process.exit(1);
});
