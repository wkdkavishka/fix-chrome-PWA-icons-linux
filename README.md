# Fix Chrome PWA Icons Linux

A JavaScript script to help manage icon paths for Chrome Progressive Web Apps (PWAs) on Linux desktop environments.

## Problem

Sometimes Chrome PWAs on Linux don't show their icons properly in the application launcher. This might be because the desktop entries point to incorrect icon paths. This script provides a simple way to update all Chrome PWA icon paths at once.

## What It Does

- Finds all Chrome PWA desktop files in `~/.local/share/applications/` (pattern: `chrome-*.desktop`)
- Creates backups of original desktop files in `~/.local/share/applications/backups/`
- Updates the `Icon=` line in each desktop file to point to the standard icon path
- Uses the expected icon location: `~/.local/share/icons/hicolor/256x256/apps/`

**<span style="color: red;">Note</span>**: This script simply replaces icon paths in all Chrome app shortcuts - it doesn't detect which ones are actually broken, but makes it easy to update them all at once.

## Features

- **Safe operation**: Creates backups before making any changes
- **Colored output**: Clear, readable console output with status indicators
- **Error handling**: Graceful handling of file operations and invalid formats
- **Summary reporting**: Shows processed, updated, and error counts

## Requirements

- [Node.js](https://nodejs.org/) (v18+)
- Linux desktop environment
- Chrome/Chromium browser with installed PWAs

## Installation

1. Clone this repository:

```bash
git clone git@github.com:wkdkavishka/fix-chrome-PWA-icons-linux.git
cd fix-chrome-PWA-icons-linux
```

2. Make the script executable:

```bash
chmod +x fix-chrome-icons.js
```

## Available Scripts

This repository includes:

- `fix-chrome-icons.js` - Main script for fixing Chrome PWA icons
- `setup.js` - Interactive cron job setup script

## Usage

Run with Node.js:

```bash
node fix-chrome-icons.js
```

Or execute directly (if executable):

```bash
./fix-chrome-icons.js
```

## How It Works

1. **File Discovery**: The script searches for desktop files matching the pattern `chrome-*.desktop`
2. **Validation**: Ensures filenames follow the expected format: `chrome-{app_id}-{profile}.desktop`
3. **Backup Creation**: Creates a backup of each desktop file before modification
4. **Icon Path Update**: Replaces the `Icon=` line with the correct path to the PNG icon
5. **Reporting**: Provides a summary of all operations performed

## Automation

### Cron Job Setup

For automatic icon updates, use the included setup script:

```bash
node setup.js
```

This interactive script will:

- Install, update, or remove a cron job
- Run the script automatically at your chosen interval
- Support running every 2, 4, 6, or 12 hours
- Use Node.js for the script

### Manual Cron Setup

Alternatively, manually add to crontab:

```bash
# Edit crontab
crontab -e

# Add line (runs every 6 hours at :00)
0 */6 * * * /usr/bin/node "/path/to/fix-chrome-icons.js" > /dev/null 2>&1
```

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
