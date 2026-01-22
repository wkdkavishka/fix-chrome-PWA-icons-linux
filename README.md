# Fix Chrome PWA Icons Linux

A TypeScript/Bun script to fix missing or broken icons for Chrome Progressive Web Apps (PWAs) on Linux desktop environments.

## Problem

When you install Chrome PWAs on Linux, the desktop entries sometimes have incorrect or missing icon paths, resulting in generic or no icons appearing in your application launcher. This script automatically detects and fixes these icon references.

## What It Does

- Scans `~/.local/share/applications/` for Chrome PWA desktop files (pattern: `chrome-*.desktop`)
- Creates backups of original desktop files in `~/.local/share/applications/backups/`
- Updates the `Icon=` line in each desktop file to point to the correct icon path
- Uses the expected icon location: `~/.local/share/icons/hicolor/256x256/apps/`

## Features

- **Safe operation**: Creates backups before making any changes
- **Colored output**: Clear, readable console output with status indicators
- **Error handling**: Graceful handling of file operations and invalid formats
- **Summary reporting**: Shows processed, updated, and error counts

## Requirements

- [Bun](https://bun.sh/) runtime
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
chmod +x fix-chrome-icons.ts
```

## Usage

Run the script:

```bash
bun run fix-chrome-icons.ts
```

Or execute directly:

```bash
./fix-chrome-icons.ts
```

## How It Works

1. **File Discovery**: The script searches for desktop files matching the pattern `chrome-*.desktop`
2. **Validation**: Ensures filenames follow the expected format: `chrome-{app_id}-{profile}.desktop`
3. **Backup Creation**: Creates a backup of each desktop file before modification
4. **Icon Path Update**: Replaces the `Icon=` line with the correct path to the PNG icon
5. **Reporting**: Provides a summary of all operations performed

## File Structure

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
