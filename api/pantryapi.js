import { Client } from '@notionhq/client';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    // Environment variables are crucial for security!
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const databaseId = process.env.NOTION_DATABASE_ID;

    if (!notion.auth || !databaseId) {
        return res.status(500).json({ error: 'Notion API key or Database ID not configured.' });
    }

    try {
        const { category, description, kcal } = req.body;

        // Get today's date in YYYY-MM-DD format
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const formattedDate = `<span class="math-inline">\{yyyy\}\-</span>{mm}-${dd}`;

        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                'Name': {
                    title: [{ text: { content: description || 'No description provided' } }]
                },
                'Category': {
                    select: { name: category }
                },
                'Kcal': {
                    number: parseInt(kcal, 10)
                },
                'Date': {
                    date: { start: formattedDate }
                }
            }
        });

        res.status(200).json({ message: 'Successfully sent to Notion!' });
    } catch (error) {
        console.error('Notion API error:', error);
        res.status(500).json({ error: 'Failed to create Notion page', details: error.message });
    }
}