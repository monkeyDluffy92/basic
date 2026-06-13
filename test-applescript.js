const { exec } = require('child_process');

let script = `tell application "Reminders"\n`;
script += `  make new reminder with properties {name:"Test Task", body:"Test Desc", priority:5}\n`;
script += `end tell`;

exec(`osascript -e '${script}'`, (error, stdout, stderr) => {
  if (error) {
    console.error('ERROR:', stderr || error);
  } else {
    console.log('SUCCESS:', stdout);
  }
});
