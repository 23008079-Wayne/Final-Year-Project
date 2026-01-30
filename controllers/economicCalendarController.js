const fs = require("fs");
const path = require("path");

// Load economic calendar events (static data)
const economicCalendarEvents = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/economicCalendarEvents.json"), "utf8")
);

// Filter and sort economic calendar events
const getCalendarEvents = (req, res) => {
    try {
        const { country, impact, date } = req.query;
        let events = economicCalendarEvents;

        // Apply filters
        if (country && country !== 'all') events = events.filter(e => e.country === country);
        if (impact && impact !== 'all') events = events.filter(e => e.impact === impact);
        if (date && date !== 'all') events = events.filter(e => e.date === date);

        // Sort by date and time
        events.sort((a, b) => {
            const dateA = new Date(a.date + 'T' + (a.time || '00:00'));
            const dateB = new Date(b.date + 'T' + (b.time || '00:00'));
            return dateA - dateB;
        });

        const countries = [...new Set(events.map(e => e.country))].sort();

        res.json({
            events,
            total: events.length,
            countries,
            allCount: economicCalendarEvents.length
        });
    } catch (error) {
        console.error('Error in economic calendar:', error);
        const countries = [...new Set(economicCalendarEvents.map(e => e.country))];
        res.json({
            events: economicCalendarEvents,
            total: economicCalendarEvents.length,
            countries,
            allCount: economicCalendarEvents.length
        });
    }
};

module.exports = { getCalendarEvents };
