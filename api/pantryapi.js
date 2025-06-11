import { Client } from '@notionhq/client';

// This function will handle both POST (create page) and GET (query database) requests
export default async function handler(req, res) {
    // Environment variables are crucial for security!
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID;

    // --- Input Validation: Check for API Key and Database ID ---
    if (!notion.auth || !databaseId) {
        console.error('SERVER ERROR: Notion API key or Database ID not configured.');
        return res.status(500).json({ error: 'Server configuration error: Notion API key or Database ID missing.' });
    }

    // --- Helper function to get today's date in YYYY-MM-DD format ---
    const getTodayFormattedDate = () => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // --- Handle POST request (Create Notion Page) ---
    if (req.method === 'POST') {
        try {
            const { category, description, kcal } = req.body;

            // Basic input validation for POST request body
            if (!category || !description || kcal === undefined) {
                return res.status(400).json({ error: 'Missing required fields for creating a Notion page (category, description, or kcal).' });
            }
            if (isNaN(parseInt(kcal, 10))) {
                 return res.status(400).json({ error: 'Kcal must be a valid number.' });
            }

            const formattedDate = getTodayFormattedDate();

            await notion.pages.create({
                parent: { database_id: databaseId },
                properties: {
                    // Assuming 'Name' is your database's Title property
                    'Name': {
                        title: [{ text: { content: description || 'No description provided' } }]
                    },
                    // Assuming 'Category' is a Select property
                    'Category': {
                        select: { name: category }
                    },
                    // Assuming 'Kcal' is a Number property
                    'Kcal': {
                        number: parseInt(kcal, 10)
                    },
                    // Assuming 'Date' is a Date property
                    'Date': {
                        date: { start: formattedDate }
                    }
                }
            });

            return res.status(200).json({ message: 'Successfully sent to Notion!' });

        } catch (error) {
            console.error('Notion API POST error:', error.message);
            // Provide more specific error messages for Notion API issues
            const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
            return res.status(500).json({ error: 'Failed to create Notion page.', details: errorMessage });
        }
    } 
    // --- Handle GET request (Query Notion Database with Filters & Sorts) ---
    else if (req.method === 'GET') {
        try {
            const todayFormatted = getTodayFormattedDate();

            const response = await notion.databases.query({
                database_id: databaseId,
                // --- CUSTOMIZE YOUR FILTERS HERE TO MATCH YOUR NOTION VIEW ---
                filter: {
                    // This combines multiple conditions with 'and'
                    and: [
                        {
                            property: 'Date', // Ensure this matches your Notion 'Date' property name exactly
                            date: {
                                equals: todayFormatted // Filters for entries where the Date is today
                            }
                        },
                        {
                            property: 'Category', // Ensure this matches your Notion 'Category' property name exactly
                            select: {
                                does_not_equal: 'Exercise' // Example: Excludes entries categorized as 'Exercise'
                            }
                        }
                        // Add more filters as needed based on your specific Notion view
                        // Example:
                        // {
                        //     property: 'Status', // Assuming a 'Status' property
                        //     status: { equals: 'Completed' } // Filters for a specific status
                        // },
                        // {
                        //     property: 'Amount', // Assuming a 'Number' property
                        //     number: { greater_than: 50 } // Filters for numbers greater than 50
                        // }
                    ]
                },
                // --- CUSTOMIZE YOUR SORTS HERE TO MATCH YOUR NOTION VIEW ---
                sorts: [
                    {
                        property: 'Date', // Ensure this matches your Notion 'Date' property name exactly
                        direction: 'descending' // Sorts by date, newest first
                    },
                    {
                        property: 'Name', // Example: Then sort by Name alphabetically
                        direction: 'ascending' 
                    }
                    // Add more sorts as needed based on your specific Notion view
                ]
            });

            // Extract relevant data for the frontend
            const items = response.results.map(page => {
                const properties = page.properties;
                return {
                    id: page.id,
                    name: properties.Name?.title[0]?.plain_text || 'Untitled', // Handle cases where title might be empty
                    category: properties.Category?.select?.name || 'N/A',
                    kcal: properties.Kcal?.number || 0,
                    date: properties.Date?.date?.start || 'N/A'
                };
            });

            return res.status(200).json({ items });

        } catch (error) {
            console.error('Notion API GET error:', error.message);
            const errorMessage = error.body ? JSON.parse(error.body).message : error.message;
            return res.status(500).json({ error: 'Failed to retrieve Notion items.', details: errorMessage });
        }
    } 
    // --- Handle unsupported methods ---
    else {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
}