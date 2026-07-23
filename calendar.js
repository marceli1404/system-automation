require('dotenv').config();
const { google } = require('googleapis');
const fs = require('fs');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } = process.env;
const TOKEN_PATH = 'token.json';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

async function listEvents(maxResults = 10) {
  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin: new Date().toISOString(),
    maxResults: maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = res.data.items || [];
  if (events.length === 0) {
    console.log('No upcoming events found.');
    return;
  }
  console.log('Upcoming events:');
  events.forEach((event) => {
    const start = event.start.dateTime || event.start.date;
    console.log(`${start} - ${event.summary}`);
  });
  return events;
}

async function createEvent(summary, start, end, description = '') {
  const event = {
    summary: summary,
    description: description,
    start: {
      dateTime: start,
      timeZone: 'Europe/London',
    },
    end: {
      dateTime: end,
      timeZone: 'Europe/London',
    },
  };

  const res = await calendar.events.insert({
    calendarId: 'primary',
    resource: event,
  });
  console.log('Event created:', res.data.htmlLink);
  return res.data;
}

async function deleteEvent(eventId) {
  await calendar.events.delete({
    calendarId: 'primary',
    eventId: eventId,
  });
  console.log('Event deleted:', eventId);
}

async function findFreeSlots(date, durationMinutes = 60) {
  const startOfDay = new Date(date);
  startOfDay.setHours(9, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(18, 0, 0, 0);

  const res = await calendar.freebusy.query({
    resource: {
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      items: [{ id: 'primary' }],
    },
  });

  const busy = res.data.calendars.primary.busy;
  const freeSlots = [];
  let current = new Date(startOfDay);

  for (const busySlot of busy) {
    const busyStart = new Date(busySlot.start);
    if (current < busyStart) {
      freeSlots.push({
        start: current.toISOString(),
        end: busyStart.toISOString(),
        durationMinutes: (busyStart - current) / 60000,
      });
    }
    current = new Date(Math.max(current, new Date(busySlot.end)));
  }

  if (current < endOfDay) {
    freeSlots.push({
      start: current.toISOString(),
      end: endOfDay.toISOString(),
      durationMinutes: (endOfDay - current) / 60000,
    });
  }

  return freeSlots;
}

const [,, command, ...args] = process.argv;

switch (command) {
  case 'list':
    listEvents(parseInt(args[0]) || 10);
    break;
  case 'create':
    createEvent(args[0], args[1], args[2], args[3] || '');
    break;
  case 'delete':
    deleteEvent(args[0]);
    break;
  case 'free':
    findFreeSlots(args[0] || new Date().toISOString().split('T')[0]).then((slots) => {
      console.log('Free slots:');
      slots.forEach((slot) => {
        const start = new Date(slot.start).toLocaleTimeString();
        const end = new Date(slot.end).toLocaleTimeString();
        console.log(`${start} - ${end} (${slot.durationMinutes} min)`);
      });
    });
    break;
  default:
    console.log('Usage:');
    console.log('  node calendar.js list [count]');
    console.log('  node calendar.js create "Title" "2024-01-01T10:00:00" "2024-01-01T11:00:00" "Description"');
    console.log('  node calendar.js delete <eventId>');
    console.log('  node calendar.js free [date]');
}
