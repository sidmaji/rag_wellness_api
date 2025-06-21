// api/query.js
const axios = require("axios");

module.exports = async (req, res) => {

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }

    const {
        AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_CHAT_DEPLOYMENT,
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        AZURE_SEARCH_API_KEY,
        AZURE_SEARCH_ENDPOINT,
        AZURE_SEARCH_INDEX,
    } = process.env;

    const query = req.body?.query;
    const searchIndex = req.body?.searchIndex || AZURE_SEARCH_INDEX;

    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }

    try {
        const embedRes = await axios.post(
            `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_EMBEDDING_DEPLOYMENT}/embeddings?api-version=2023-05-15`,
            { input: query },
            {
                headers: {
                    "api-key": AZURE_OPENAI_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const embedding = embedRes.data.data[0].embedding;

        const searchRes = await axios.post(
            `${AZURE_SEARCH_ENDPOINT}indexes/${searchIndex}/docs/search.post.search?api-version=2024-07-01`,
            {
                vectorQueries: [
                    {
                        kind: "vector",
                        vector: embedding.flat(),
                        fields: "contentVector",
                        k: 5,
                    },
                ],
                select: "content",
            },
            {
                headers: {
                    "api-key": AZURE_SEARCH_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const context = searchRes.data.value.map((doc) => doc.content).join("\n\n");

        const chatRes = await axios.post(
            `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_CHAT_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview`,
            {
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant. Use the provided context to answer the question. Do not make up answers. If you don't know the answer, say 'I don't know'.",
                    },
                    {
                        role: "user",
                        content: `Context:\n${context}\n\nQuestion: ${query}`,
                    },
                ],
                temperature: 1,
            },
            {
                headers: {
                    "api-key": AZURE_OPENAI_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        res.json({ answer: chatRes.data.choices[0].message.content });
    } catch (err) {
        console.error("💥 Error:", err.response?.data || err.message);
        res.status(500).json({ error: "Something went wrong" });
    }
};
