import { Client } from '@notionhq/client';

export default async function handler(req, res) {
    const allowedOrigin = 'https://sanvals.github.io/';
    
    // Set headers for all responses
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Allow GET, POST, and OPTIONS
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization'); // Allow Content-Type and Authorization headers
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight response for 24 hours

    // Handle preflight OPTIONS request
    // Browsers send an OPTIONS request before actual POST/GET requests for CORS validation
    if (req.method === 'OPTIONS') {
        return res.status(200).end(); // Respond with 200 OK and no body for preflight
    }
    // --- End CORS Headers Configuration ---


    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID; // Your main Pantry database ID

    const sumDatabaseId = process.env.NOTION_SUM_DATABASE_ID;
    const monthlyDatabaseId = process.env.NOTION_MONTHLY_DATABASE_ID;

    if (!process.env.NOTION_API_KEY || !databaseId || !sumDatabaseId || !monthlyDatabaseId) {
        console.error('SERVER ERROR: One or more Notion API keys/Database IDs not configured.');
        return res.status(500).json({ error: 'Server configuration error: Notion API key or required Database IDs missing.' });
    }

    const getTodayFormattedDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- UPDATED Mapping for Notion 'Type' property tags with emojis ---
    const notionCategoryMap = {
        "Breakfast": "🥣 Breakfast",
        "Collagen": "🦵Collagen",
        "Coffee": "☕ Coffee",
        "Lunch": "🍽️ Lunch",
        "Exercise": "🧘 Exercise",
        "Other": "✨ Other"
    };

    async function findPageByTitle(dbId, title) {
        try {
            const response = await notion.databases.query({
                database_id: dbId,
                filter: {
                    property: 'title',
                    title: {
                        equals: title
                    }
                }
            });

            if (response.results.length > 0) {
                if (response.results.length > 1) {
                    console.warn(`[RELATION] Multiple pages found with title "${title}" in database ${dbId}. Using the first one found.`);
                }
                return response.results[0].id;
            } else {
                console.warn(`[RELATION] Page with title "${title}" not found in database ${dbId}.`);
                return null;
            }
        } catch (error) {
            console.error(`[RELATION] Error finding page with title "${title}" in database ${dbId}:`, error.message);
            throw new Error(`Failed to find required Notion page for relation: ${title}`);
        }
    }

    if (req.method === 'GET') {
        try {
            const todayFormatted = getTodayFormattedDate();
            console.log(`[GET] Attempting to retrieve Notion pages for date: ${todayFormatted}`);

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
                        property: 'Date',
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
                    total: properties.Total?.formula?.number || 0, // Fetches the result of the 'Total' formula
                    date: properties.Date?.date?.start || 'N/A'
                };
            });

            console.log(`[GET] Successfully retrieved ${items.length} items for today.`);
            return res.status(200).json({ items });

        } catch (error) {
            console.error('[GET] Notion API error:', error.message);
            const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
            return res.status(500).json({ error: 'Failed to retrieve Notion items.', details: errorMessage });
        }
    }
    else if (req.method === 'POST') {
        try {
            let { category, description, kcal } = req.body;

            // Ensure description is always a string and trimmed.
            description = typeof description === 'string' ? description.trim() : '';
            
            // --- MODIFIED: Use a single space if description is empty ---
            // The Notion API requires the title property to NOT be empty.
            // Using a single space makes it appear blank in Notion's UI.
            const contentForNotionTitle = description === '' ? ' ' : description;
            // --- END MODIFIED ---

            if (!category || !kcal) {
                console.warn('[POST] Missing required fields: category or kcal.');
                return res.status(400).json({ error: 'Category and Kcal are required.' });
            }
            if (isNaN(parseInt(kcal, 10))) {
                console.warn('[POST] Invalid Kcal value:', kcal);
                return res.status(400).json({ error: 'Kcal must be a valid number.' });
            }

            const todayFormatted = getTodayFormattedDate();

            const notionTag = notionCategoryMap[category];
            if (!notionTag) {
                console.warn(`[POST] No Notion tag mapping found for category: ${category}`);
                return res.status(400).json({ error: `Invalid category selected: ${category}. No matching Notion tag found.` });
            }

            const sumPageId = await findPageByTitle(sumDatabaseId, "1500");
            const monthlyPageId = await findPageByTitle(monthlyDatabaseId, "1800");

            if (!sumPageId) {
                return res.status(500).json({ error: "Required 'Sum' relation page (1500) not found in its database. Please ensure it exists." });
            }
            if (!monthlyPageId) {
                return res.status(500).json({ error: "Required 'Monthly' relation page (1800) not found in its database. Please ensure it exists." });
            }

            console.log(`[POST] Adding new Notion page: Activity=${contentForNotionTitle}, Type=${notionTag}, Cal=${kcal}`);

            const newPageProperties = {
                "Activity": {
                    title: [
                        {
                            text: { content: contentForNotionTitle } // Use the guaranteed string content (empty space if blank)
                        }
                    ]
                },
                "Type": {
                    select: { name: notionTag }
                },
                "Cal": { // Where the user's direct Kcal input goes
                    number: parseInt(kcal, 10)
                },
                "Date": {
                    date: { start: todayFormatted }
                },
                "Sum": {
                    relation: [{ id: sumPageId }]
                },
                "Monthly": {
                    relation: [{ id: monthlyPageId }]
                }
            };

            const response = await notion.pages.create({
                parent: { database_id: databaseId },
                properties: newPageProperties
            });

            console.log('[POST] Successfully added page to Notion:', response.id);
            return res.status(200).json({ message: 'Entry added successfully to Notion!', pageId: response.id });

        } catch (error) {
            console.error('[POST] Notion API error:', error.message);
            const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
            if (error.code === 'validation_error' && error.body) {
                try {
                    const errorDetails = JSON.parse(error.body);
                    return res.status(400).json({ error: 'Notion validation error.', details: errorDetails.message });
                } catch (parseError) {
                    return res.status(400).json({ error: 'Failed to add entry to Notion.', details: errorMessage });
                }
            }
            return res.status(500).json({ error: 'Failed to add entry to Notion.', details: errorMessage });
        }
    }
    else {
        console.log(`[${req.method}] Method not allowed for this endpoint.`);
        return res.status(405).json({ message: 'Method Not Allowed', allowed: ['GET', 'POST'] });
    }
}