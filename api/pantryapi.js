import { Client } from '@notionhq/client';

// This function will handle both POST (create page) and GET (query database) requests
export default async function handler(req, res) {
    // Environment variables are crucial for security!
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notion.auth || !databaseId) {
        return res.status(500).json({ error: 'Notion API key or Database ID not configured on the server.' });
    }

    if (req.method === 'POST') {
        // --- Handle POST request (Create Notion Page) ---
        try {
            const { category, description, kcal } = req.body;

            // Get today's date in YYYY-MM-DD format
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            const formattedDate = `${yyyy}-${mm}-${dd}`;

            await notion.pages.create({
                parent: { database_id: databaseId },
                properties: {
                    // Assuming 'Name' is your title property
                    'Name': {
                        title: [{ text: { content: description || 'No description provided' } }]
                    },
                    // Assuming 'Category' is a select property
                    'Category': {
                        select: { name: category }
                    },
                    // Assuming 'Kcal' is a number property
                    'Kcal': {
                        number: parseInt(kcal, 10)
                    },
                    // Assuming 'Date' is a date property
                    'Date': {
                        date: { start: formattedDate }
                    }
                }
            });

            res.status(200).json({ message: 'Successfully sent to Notion!' });
        } catch (error) {
            console.error('Notion API POST error:', error);
            res.status(500).json({ error: 'Failed to create Notion page', details: error.message });
        }
    } else if (req.method === 'GET') {
        // --- Handle GET request (Query Notion Database) ---
        try {
            const response = await notion.databases.query({
                database_id: databaseId,
                // You can add filters and sorts here if needed
                // e.g., filter: { property: 'Date', date: { on_or_before: new Date().toISOString() } }
                // e.g., sort: [{ property: 'Date', direction: 'descending' }]
            });

            // Extract relevant data for the frontend
            const items = response.results.map(page => {
                const properties = page.properties;
                return {
                    id: page.id,
                    name: properties.Name?.title[0]?.plain_text || 'Untitled',
                    category: properties.Category?.select?.name || 'N/A',
                    kcal: properties.Kcal?.number || 0,
                    date: properties.Date?.date?.start || 'N/A'
                };
            });

            res.status(200).json({ items });
        } catch (error) {
            console.error('Notion API GET error:', error);
            res.status(500).json({ error: 'Failed to retrieve Notion items', details: error.message });
        }
    } else {
        res.status(405).json({ message: 'Method Not Allowed' });
    }
}