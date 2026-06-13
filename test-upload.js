const fs = require('fs');
fs.writeFileSync('test.ics', 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Test Event\nEND:VEVENT\nEND:VCALENDAR');
fetch('https://tmpfiles.org/api/v1/upload', {
  method: 'POST',
  body: (() => {
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync('test.ics')]), 'test.ics');
    return fd;
  })()
}).then(res => res.json()).then(console.log).catch(console.error);
