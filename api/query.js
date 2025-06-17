// api/query.js
const express = require("express");
const router = express.Router();
const axios = require("axios");

const {
    AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_CHAT_DEPLOYMENT,
    AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
    AZURE_SEARCH_API_KEY,
    AZURE_SEARCH_ENDPOINT,
    AZURE_SEARCH_INDEX,
} = process.env;

const EMBEDDING_URL = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_EMBEDDING_DEPLOYMENT}/embeddings?api-version=2023-05-15`;
const CHAT_URL = `${AZURE_OPENAI_ENDPOINT}openai/deployments/${AZURE_OPENAI_CHAT_DEPLOYMENT}/chat/completions?api-version=2024-12-01-preview`;

router.get("/test", (req, res) => {
  res.json({ message: "API is working on Vercel!" });
});

router.post("/", async (req, res) => {
    console.log("Incoming POST /api/query:", req.body);
    console.log("Headers:", req.headers);
    console.log("Environment Variables:", {
        AZURE_OPENAI_API_KEY,
        AZURE_OPENAI_ENDPOINT,
        AZURE_OPENAI_CHAT_DEPLOYMENT,
        AZURE_OPENAI_EMBEDDING_DEPLOYMENT,
        AZURE_SEARCH_API_KEY,
        AZURE_SEARCH_ENDPOINT,
        AZURE_SEARCH_INDEX,
    });
    const query = req.body.query;
    if (!query) {
        return res.status(400).json({ error: "Query is required" });
    }
    try {
        // 1. Get embedding
        const embedRes = await axios.post(
            EMBEDDING_URL,
            { input: query },
            {
                headers: {
                    "api-key": AZURE_OPENAI_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        const embedding = embedRes.data.data[0].embedding;
        //const embedding = embedRes.data.data[0].embedding; // Adjusted to match the expected response structure
        //console.log("🧠 Embedding vector:", embedding.slice(0, 5));

        console.log("Embedding length:", embedding.length);
        console.log("Embedding sample:", embedding.slice(0, 5));
        console.log("Embedding is array?", Array.isArray(embedding));
        console.log(embedding);
        
        // 2. Search Azure Vector DB
        const searchRes = await axios.post(
            //`${AZURE_SEARCH_ENDPOINT}indexes/${AZURE_SEARCH_INDEX}/docs/search?api-version=2023-07-01-Preview`,
            `${AZURE_SEARCH_ENDPOINT}indexes/${AZURE_SEARCH_INDEX}/docs/search.post.search?api-version=2024-07-01`,
            {
                vectorQueries:[ {
                    "kind": "vector",
                    //value: embedding.flat(),
                    "vector": embedding.flat(), // Example vector, replace with actual embedding
                    "fields": "contentVector",
                    "k": 5
                }],
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

        // 3. Generate final response using GPT-4o
        const chatRes = await axios.post(
            CHAT_URL,
            {
                messages: [
                    {
                        role: "system",
                        content: "You are a helpful assistant. Use the provided context to answer the question.",
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

        const answer = chatRes.data.choices[0].message.content;
        res.json({ answer });
    } catch (err) {
        console.error(err.response?.data || err.message);
        console.error("Error detail:", err?.response?.data || err.message);
        res.status(500).json({ error: "Something went wrong" });
    }
});

module.exports = router;
