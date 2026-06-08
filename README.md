# Fix Chrome PWA Icons Linux

A lightweight JavaScript/TypeScript utility to automate and fix icon paths for Google Chrome Progressive Web Apps (PWAs) on Linux desktop environments (optimized for KDE Plasma and GTK).

## Problem

Sometimes Chrome PWAs on Linux don't show their icons properly in the application launcher. This happens because Chrome's generated `.desktop` files point to missing or incorrect icon paths. This utility corrects the `Icon=` path of PWA shortcuts to point to their cached PNG images.

## Features

- **Safe operation**: Only modifies files if `Icon=` paths need correction. Creates a `.bak` backup first.
- **Real-Time Automation**: Uses systemd user path units (`.path`) to watch `~/.local/share/applications/` and immediately fix newly installed/updated PWAs.
- **Scheduled Automation**: Supports cron-based triggers for environments without systemd.
- **Node & Bun Support**: Runs seamlessly on either Node.js or [Bun](https://bun.sh/) for maximum performance.
- **Zero Sudo Requirements**: Fully complies with XDG specifications, installing into user-space (`~/.local/share/fix-chrome-icons/`).
- **Safety Checks**: Validates that KDE Plasma is present before starting, with fallback continuation prompts.

## Quick Install (One-Line Installer)

You can run the interactive setup in a single line. It automatically downloads the latest version, installs it to user-space, detects your preferred runtime (`bun` or `node`), and configures automation:

```bash
bash -c 'curl -fsSL https://raw.githubusercontent.com/wkdkavishka/fix-chrome-PWA-icons-linux/master/setup.js -o /tmp/setup.js && (command -v bun &>/dev/null && bun /tmp/setup.js || node /tmp/setup.js)'
```

## Manual Installation

1. Clone this repository:

```bash
git clone git@github.com:wkdkavishka/fix-chrome-PWA-icons-linux.git
cd fix-chrome-PWA-icons-linux
```

2. Run the local setup wizard:

Using Bun (recommended):
```bash
bun setup.js
```

Using Node.js:
```bash
node setup.js
```

## How It Works

1. **Detection & Verification**: Confirms a KDE/Plasma session is running (prompts to override if not detected).
2. **File Discovery**: Reads all desktop entries matching the pattern `chrome-*.desktop` in `~/.local/share/applications/`.
3. **Change Verification**: Compares the current `Icon=` value with the target standard PWA icon path (`~/.local/share/icons/hicolor/256x256/apps/`).
4. **Correction & Backup**: If paths do not match, it backs up the file to `~/.local/share/applications/backups/` and updates the shortcut path. If already correct, it skips any write operations to avoid triggering infinite file-watcher loops.
5. **Cache Refresh**: Runs `update-desktop-database` and `gtk-update-icon-cache` using absolute paths to immediately refresh your launcher's icons.

## Automation Methods

During the interactive setup, you can configure:

### 1. File Watcher (Recommended for Systemd)
Uses a systemd user path unit to monitor `~/.local/share/applications/`. It uses native OS notifications (`inotify`) to run the correction script *immediately* when any desktop entry is created or modified.
- Services installed: `~/.config/systemd/user/fix-chrome-icons.path` and `.service`
- Controlled via: `systemctl --user status fix-chrome-icons.path`

### 2. Cron Job
Sets up a traditional cron task using the local crontab to check for and correct icon paths on an interval (every 2, 4, 6, or 12 hours).

### 3. Manual Cron Setup
If you prefer configuring cron manually:

```bash
# Edit your user crontab
crontab -e

# Add the following entry (runs every 6 hours)
0 */6 * * * PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin "/usr/bin/node" "/home/YOUR_USER/.local/share/fix-chrome-icons/fix-chrome-icons.js" > /dev/null 2>&1
```
*(Replace `/usr/bin/node` with `/home/YOUR_USER/.bun/bin/bun` if using Bun)*


The script expects this directory structure:

```
~/.local/share/
├── applications/
│   ├── chrome-*.desktop          # PWA desktop files
│   └── backups/                  # Created by this script
└── icons/
    └── hicolor/
        └── 256x256/
            └── apps/
                └── chrome-*.png  # PWA icons
```

## Example Output

```
Found File List:
/home/user/.local/share/applications/chrome-gmail-Default.desktop
/home/user/.local/share/applications/chrome-youtube-Default.desktop
Found 2 Chrome desktop files to process

Processing: chrome-gmail-Default.desktop
  ✓ Backup created: chrome-gmail-Default.desktop.bak
  ✓ Updated icon path to: /home/user/.local/share/icons/hicolor/256x256/apps/chrome-gmail-Default.png

Processing: chrome-youtube-Default.desktop
  ✓ Backup created: chrome-youtube-Default.desktop.bak
  ✓ Updated icon path to: /home/user/.local/share/icons/hicolor/256x256/apps/chrome-youtube-Default.png

=== Summary ===
Processed: 2 files
Updated: 2 files
Errors: 0
Backups saved in: /home/user/.local/share/applications/backups
Updating KDE Icon cache...
✓ KDE Icon cache updated successfully
Updating GTK icon cache...
✓ GTK icon cache updated successfully
Done!
```

## Safety

- **Backups**: Original files are backed up before any changes
- **Validation**: Only processes files with valid naming conventions
- **Error handling**: Continues processing other files if one fails
- **Non-destructive**: Only modifies the `Icon=` line, preserving all other desktop file content

## Troubleshooting

### No Chrome desktop files found

- Ensure you have Chrome PWAs installed
- Check that PWAs were created with "Create shortcut" option
- Verify desktop files are in `~/.local/share/applications/`

### Icon files not found

- The script updates icon paths but doesn't create the actual icon files
- Icons should be automatically created by Chrome when installing PWAs
- If icons are missing, you may need to reinstall the PWAs

### Permission errors

- Ensure the script has read/write permissions to your applications directory
- Run with appropriate user permissions (not as root)

## License

MIT License - feel free to use, modify, and distribute.

## Contributing

Pull requests are welcome! Please ensure:

- Code follows the existing style
- Add appropriate error handling
- Test with various PWA configurations
- Update documentation as needed

## Support

If you encounter issues:

1. Check the troubleshooting section above
2. Verify your directory structure matches expectations
3. Create an issue with details about your Linux distribution and Chrome version
