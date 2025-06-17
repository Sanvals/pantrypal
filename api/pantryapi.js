import { Client } from '@notionhq/client';
import { getTodayFormattedDate, getStartOfWeek, getEndOfWeek, formatError } from './helpers.js';

const WEEKS_TO_FETCH = 4;

const notionCategoryMap = {
    "Breakfast": "🥣 Breakfast",
    "Collagen": "🦵Collagen",
    "Coffee": "☕ Coffee",
    "Lunch": "🍽️ Lunch",
    "Exercise": "🧘 Exercise",
    "Other": "✨ Other"
};

export default async function handler(req, res) {
    const allowedOrigin = 'https://sanvals.github.io';

    // Headers for CORS
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');

    // Handle preflight OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID;
    const sumPageId = process.env.NOTION_SUM_PAGE_ID;
    const monthlyPageId = process.env.NOTION_MONTHLY_PAGE_ID;

    // Validate essential environment variables are configured
    if (!process.env.NOTION_API_KEY || !databaseId || !sumPageId || !monthlyPageId) {
        console.error('SERVER ERROR: One or more Notion API keys/Database IDs/Page IDs not configured.');
        return res.status(500).json({ error: 'Server configuration error: Missing Notion API key or required IDs.' });
    }

    // --- GET Request Handler (for both Today and History) ---
    if (req.method === 'GET') {
        // Determine if requesting history data or today's data
        const period = req.query.period;

        if (period === 'history') {
            console.log('[GET] Fetching historical data...');
            try {
                const WEEKLY_KCAL_TARGET_TOTAL = 1800 * 7; // Weekly target for history calculation
                const combinedFilters = [];
                const weekKeys = [];

                // Prepare filters for the current week and 5 previous weeks (total 6 weeks)
                for (let i = 0; i < WEEKS_TO_FETCH; i++) {
                    const tempDate = new Date(); // Start with current date
                    // Go back 'i' full weeks (e.g., i=0 is current week, i=1 is last week, etc.)
                    tempDate.setDate(tempDate.getDate() - i * 7);

                    const weekStartDate = getStartOfWeek(tempDate);
                    const weekEndDate = getEndOfWeek(weekStartDate);
                    weekKeys.push(weekStartDate.toISOString().split('T')[0]);
                    combinedFilters.push({
                        property: 'Date',
                        date: {
                            on_or_after: weekStartDate.toISOString().split('T')[0],
                            on_or_before: weekEndDate.toISOString().split('T')[0]
                        }
                    });
                }

                // Query Notion for all items within the combined 6-week period
                const response = await notion.databases.query({
                    database_id: databaseId,
                    filter: {
                        or: combinedFilters // Combine all weekly filters with an 'or' condition
                    },
                    sorts: [
                        {
                            property: 'Date',
                            direction: 'descending', // Get most recent first
                        },
                    ],
                });

                // Aggregate Kcal by week
                const aggregatedWeeks = {};

                response.results.forEach(page => {
                    // Use 'Cal' for summation as it's the direct input column
                    const kcalValue = page.properties.Cal?.number || 0;
                    const dateProperty = page.properties.Date?.date?.start;

                    if (dateProperty) {
                        const itemDate = new Date(dateProperty);
                        const startOfWeek = getStartOfWeek(itemDate);
                        const weekKey = startOfWeek.toISOString().split('T')[0]; // Use start of week date string as key

                        if (!aggregatedWeeks[weekKey]) {
                            aggregatedWeeks[weekKey] = {
                                totalKcal: 0,
                                weekStartDate: startOfWeek,
                                weekEndDate: getEndOfWeek(startOfWeek)
                            };
                        }
                        aggregatedWeeks[weekKey].totalKcal += kcalValue;
                    }
                });

                // Structure the data for the frontend (oldest week first, then newest)
                // Loop backwards (from 3 to 0) to get weeks in chronological order from oldest to newest
                const weeksData = weekKeys.reverse().map(weekKey => {
                    const weekData = aggregatedWeeks[weekKey] || {
                        totalKcal: 0,
                        weekStartDate: getStartOfWeek(weekKey),
                        weekEndDate: getEndOfWeek(weekKey)
                    };
                    const startDateFormatted = weekData.weekStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    const endDateFormatted = weekData.weekEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return {
                        weekRange: `${startDateFormatted} - ${endDateFormatted}`,
                        totalKcal: weekData.totalKcal,
                        weeklyTarget: WEEKLY_KCAL_TARGET_TOTAL,
                        excess: weekData.totalKcal - WEEKLY_KCAL_TARGET_TOTAL
                    };
                });

                console.log(`[GET History] Successfully retrieved and aggregated data for ${weeksData.length} weeks.`);
                return res.status(200).json({ history: weeksData });

            } catch (error) {
                console.error('[GET History] Notion API error:', error.message);
                return res.status(500).json({ error: 'Failed to fetch historical data from Notion.', details: formatError(error) });
            }
        } else { // Default GET behavior: fetch today's data
            console.log('[GET] Fetching today\'s data...');
            try {
                const todayFormatted = getTodayFormattedDate();

                const response = await notion.databases.query({
                    database_id: databaseId,
                    filter: {
                        property: 'Date',
                        date: {
                            equals: todayFormatted
                        }
                    },
                    sorts: [
                        {
                            // Sort by created_time to get items in order of logging for today
                            timestamp: 'created_time',
                            direction: 'descending'
                        }
                    ]
                });

                const items = response.results.map(page => {
                    const properties = page.properties;
                    return {
                        id: page.id,
                        name: properties.Activity?.title[0]?.plain_text || 'Untitled Page',
                        Type: properties.Type?.select?.name || 'N/A',
                        total: properties.Total?.formula?.number || 0, // Reads from the 'Total' formula column
                        date: properties.Date?.date?.start || 'N/A'
                    };
                });

                console.log(`[GET] Successfully retrieved ${items.length} items for today.`);
                return res.status(200).json({ items });

            } catch (error) {
                console.error('[GET Today] Notion API error:', error.message);
                return res.status(500).json({ error: 'Failed to retrieve Notion items for today.', details: formatError(error) });
            }
        }
    }
    // --- POST Request Handler ---
    else if (req.method === 'POST') {
        try {
            let { category, description, kcal } = req.body;

            // Ensure description is always a string and trimmed.
            description = typeof description === 'string' ? description.trim() : '';

            // The Notion API requires the title property to NOT be empty.
            // Using a single space makes it appear blank in Notion's UI.
            const contentForNotionTitle = description === '' ? ' ' : description;

            // Basic input validation
            if (!category || !kcal) {
                console.warn('[POST] Missing required fields: category or kcal.');
                return res.status(400).json({ error: 'Category and Kcal are required.' });
            }
            if (isNaN(parseInt(kcal, 10))) {
                console.warn('[POST] Invalid Kcal value:', kcal);
                return res.status(400).json({ error: 'Kcal must be a valid number.' });
            }

            const todayFormatted = getTodayFormattedDate();

            // Map frontend category to Notion's exact tag name (with emoji)
            const notionTag = notionCategoryMap[category];
            if (!notionTag) {
                console.warn(`[POST] No Notion tag mapping found for category: ${category}`);
                return res.status(400).json({ error: `Invalid category selected: ${category}. No matching Notion tag found.` });
            }

            console.log(`[POST] Adding new Notion page: Activity=${contentForNotionTitle}, Type=${notionTag}, Cal=${kcal}`);

            // Define properties for the new Notion page
            const newPageProperties = {
                "Activity": {
                    title: [
                        {
                            text: { content: contentForNotionTitle }
                        }
                    ]
                },
                "Type": {
                    select: { name: notionTag }
                },
                "Cal": { // The direct Kcal input is written to the 'Cal' column
                    number: parseInt(kcal, 10)
                },
                "Date": {
                    date: { start: todayFormatted }
                },
                // Establish relations using the fixed page IDs
                // Notion's Rollup properties in the Sum and Monthly pages should automatically update
                "Sum": {
                    relation: [{ id: sumPageId }]
                },
                "Monthly": {
                    relation: [{ id: monthlyPageId }]
                }
            };

            // Create the new page in Notion
            const response = await notion.pages.create({
                parent: { database_id: databaseId },
                properties: newPageProperties
            });

            console.log('[POST] Successfully added page to Notion:', response.id);
            return res.status(200).json({ message: 'Entry added successfully to Notion!', pageId: response.id });

        } catch (error) {
            console.error('[POST] Notion API error:', error.message);
            const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
            // Handle Notion-specific validation errors for better client feedback
            if (error.code === 'validation_error' && error.body) {
                try {
                    const errorDetails = JSON.parse(error.body);
                    return res.status(400).json({ error: 'Notion validation error.', details: errorDetails.message });
                } catch (parseError) {
                    // Fallback if error body itself cannot be parsed
                    return res.status(400).json({ error: 'Failed to add entry to Notion.', details: errorMessage });
                }
            }
            return res.status(500).json({ error: 'Failed to add entry to Notion.', details: errorMessage });
        }
    }
    // --- DELETE Request Handler ---
    else if (req.method === 'DELETE') {
        try {
            const { pageId } = req.body; // Expecting pageId in the request body

            if (!pageId) {
                console.warn('[DELETE] Missing page ID for deletion.');
                return res.status(400).json({ error: 'Page ID is required to delete an item.' });
            }

            console.log(`[DELETE] Attempting to archive Notion page with ID: ${pageId}`);

            // Archive the Notion page. Notion's Rollup properties will automatically recalculate sums.
            await notion.pages.update({
                page_id: pageId,
                archived: true, // This is how Notion "deletes" a page
            });

            console.log(`[DELETE] Successfully archived Notion page: ${pageId}`);
            return res.status(200).json({ message: 'Item deleted successfully (archived) from Notion!' });

        } catch (error) {
            console.error('[DELETE] Notion API error:', error.message);
            const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
            // Handle Notion specific errors, e.g., if page_id is invalid
            if (error.code === 'validation_error' || error.code === 'object_not_found') {
                return res.status(404).json({ error: 'Notion page not found or invalid ID.', details: errorMessage });
            }
            return res.status(500).json({ error: 'Failed to delete Notion item.', details: errorMessage });
        }
    }
    // --- Method Not Allowed Handler ---
    else {
        console.log(`[${req.method}] Method not allowed for this endpoint.`);
        return res.status(405).json({ message: 'Method Not Allowed', allowed: ['GET', 'POST', 'DELETE'] });
    }
}