// sandbox.js - Transformers.js Multi-lingual Embeddings
console.log("Sandbox script loaded (Transformers.js version).");

// Import Transformers.js from CDN
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0';

// Configure environment for Chrome extension sandbox
env.allowLocalModels = false;
env.useBrowserCache = false; // Disable IndexedDB cache (not available in sandbox)
env.useCustomCache = false;

let embeddingModel = null;
let loadError = null;
let loadingPromise = null;

// Model loading
async function loadModel() {
    if (embeddingModel) return embeddingModel;

    // Return existing promise if already loading
    if (loadingPromise) return loadingPromise;

    console.log("Loading multilingual embedding model...");

    loadingPromise = (async () => {
        try {
            // Use multilingual MiniLM model - supports 50+ languages including Japanese and English
            const model = await pipeline(
                'feature-extraction',
                'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
                {
                    progress_callback: (progress) => {
                        console.log(`Model loading progress: ${JSON.stringify(progress)}`);
                    }
                }
            );
            console.log("Multilingual embedding model loaded successfully!");
            embeddingModel = model;
            loadError = null;
            return model;
        } catch (error) {
            console.error("Failed to load model:", error);
            loadError = error.message;
            throw error;
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

// Calculate Cosine Similarity between two vectors
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Get embedding for a text
async function getEmbedding(text) {
    if (!embeddingModel) {
        await loadModel();
    }

    if (!embeddingModel) {
        throw new Error("Model not loaded: " + (loadError || "Unknown error"));
    }

    // Run embedding pipeline (returns nested array, we take mean pooling result)
    const output = await embeddingModel(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
}

// Handle relevance check request
async function handleRelevanceCheck(data) {
    const { pageTitle, studyTopics } = data;

    if (!studyTopics || studyTopics.length === 0) {
        return { score: 1.0, details: "No topics registered" };
    }

    // Get embedding for page title
    const titleEmbedding = await getEmbedding(pageTitle);

    // Calculate max similarity with any topic
    let maxSimilarity = -1;

    for (const topic of studyTopics) {
        const topicEmbedding = await getEmbedding(topic);
        const sim = cosineSimilarity(titleEmbedding, topicEmbedding);
        console.log(`Similarity("${pageTitle}", "${topic}") = ${sim.toFixed(4)}`);
        if (sim > maxSimilarity) {
            maxSimilarity = sim;
        }
    }

    console.log(`[Sandbox] Title: "${pageTitle}", Max Similarity: ${maxSimilarity.toFixed(4)}`);

    return { score: maxSimilarity };
}

// Listen for messages from parent (offscreen.js)
window.addEventListener('message', async (event) => {
    const message = event.data;
    if (!message) return;

    // Handle Status Check
    if (message.type === 'CHECK_STATUS') {
        event.source.postMessage({
            type: 'CHECK_STATUS_RESULT',
            requestId: message.requestId,
            result: {
                loaded: !!embeddingModel,
                error: loadError,
                loading: !!loadingPromise
            }
        }, event.origin);
        return;
    }

    // Handle Relevance Check
    if (message.type === 'CHECK_RELEVANCE') {
        const { requestId, data } = message;
        try {
            const result = await handleRelevanceCheck(data);
            event.source.postMessage({
                type: 'CHECK_RELEVANCE_RESULT',
                requestId: requestId,
                result: result
            }, event.origin);
        } catch (e) {
            console.error("Error in handleRelevanceCheck:", e);
            event.source.postMessage({
                type: 'CHECK_RELEVANCE_RESULT',
                requestId: requestId,
                error: e.message
            }, event.origin);
        }
        return;
    }
});

// Initialize model on load
loadModel();
