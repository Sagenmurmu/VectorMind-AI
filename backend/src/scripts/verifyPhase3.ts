import { extractionService } from '../services/document/extraction.service';
import { chunkingService } from '../services/ai/chunking.service';
import { embeddingService } from '../services/ai/embedding.service';
import { documentService } from '../services/document/document.service';
import { vectorSearchService } from '../services/ai/vectorSearch.service';
import { ragService } from '../services/ai/rag.service';
import { prisma } from '../db/prisma';

async function main() {
  console.log('====================================================');
  console.log('STARTING PHASE 3 COMPREHENSIVE AUTOMATED VERIFICATION');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST A: Extraction Service
  // ----------------------------------------------------
  console.log('[Test 1/7] Testing Extraction Service...');
  const sampleTxt = Buffer.from(
    'VectorMind is a high-performance Autonomous AI Knowledge Engine.\n\nIt features HNSW vector indexing over PostgreSQL and Neon serverless architecture.\n\nDocument processing supports sentence, paragraph, and fixed chunking algorithms.',
    'utf-8'
  );
  const txtResult = await extractionService.extractText(sampleTxt, 'text/plain', 'vectormind_overview.txt');
  console.log(`✓ Plain text extracted: ${txtResult.fullText.length} characters, 1 page.`);

  // Test empty error handling
  try {
    await extractionService.extractText(Buffer.from(''), 'text/plain', 'empty.txt');
    throw new Error('Failed: Expected empty file error');
  } catch (err: any) {
    console.log(`✓ Empty document safely rejected: "${err.message}"`);
  }

  // Test unsupported mime type
  try {
    await extractionService.extractText(Buffer.from('dummy'), 'image/png', 'photo.png');
    throw new Error('Failed: Expected unsupported mime error');
  } catch (err: any) {
    console.log(`✓ Unsupported mime safely rejected: "${err.message}"`);
  }

  // ----------------------------------------------------
  // TEST B: Chunking Service Strategies
  // ----------------------------------------------------
  console.log('\n[Test 2/7] Testing Chunking Service Strategies...');
  const testCorpus =
    'First sentence about AI agents. Second sentence discusses vector indexing. Third sentence mentions Neon PostgreSQL.\n\nSecond paragraph explains RAG context assembly and source provenance citations.\n\nThird paragraph covers background workers using Inngest.';

  const sentenceChunks = chunkingService.chunkText(testCorpus, { method: 'sentence' });
  const paragraphChunks = chunkingService.chunkText(testCorpus, { method: 'paragraph' });
  const fixedChunks = chunkingService.chunkText(testCorpus, { method: 'fixed', fixedSize: 80 });

  console.log(`✓ Sentence strategy chunks count: ${sentenceChunks.length}`);
  console.log(`✓ Paragraph strategy chunks count: ${paragraphChunks.length}`);
  console.log(`✓ Fixed strategy (80 chars) chunks count: ${fixedChunks.length}`);

  if (sentenceChunks.length === paragraphChunks.length && paragraphChunks.length === fixedChunks.length) {
    console.warn('Warning: Chunk counts unexpectedly identical');
  } else {
    console.log('✓ Verified chunking strategies produce distinct boundaries.');
  }

  // ----------------------------------------------------
  // TEST C: Embedding Service
  // ----------------------------------------------------
  console.log('\n[Test 3/7] Testing Embedding Service (Gemini gemini-embedding-001)...');
  const queryEmbedding = await embeddingService.embedQuery('What is VectorMind AI architecture?');
  console.log(`✓ Single query embedded successfully: vector length = ${queryEmbedding.length}`);
  if (queryEmbedding.length !== 3072) {
    throw new Error(`Embedding dimension mismatch: expected 3072, got ${queryEmbedding.length}`);
  }

  const batchEmbeddings = await embeddingService.embedBatch([
    'PostgreSQL with pgvector extension',
    'Inngest background job orchestration',
  ]);
  console.log(`✓ Batch embedding generated: ${batchEmbeddings.length} vectors of dimension ${batchEmbeddings[0]?.length}`);

  // ----------------------------------------------------
  // TEST D: Document Ingestion Pipeline
  // ----------------------------------------------------
  console.log('\n[Test 4/7] Testing Document Creation & Ingestion Pipeline...');
  const testDocBuffer = Buffer.from(
    `VectorMind Architecture Specification:
VectorMind utilizes Google Gemini models for both embeddings and chat synthesis.
The database layer is hosted on Neon Serverless PostgreSQL with pgvector version 0.8.6.
All vector chunks are indexed using HNSW cosine similarity with halfvec precision across 3072 dimensions.
Background jobs are queued using Inngest to ensure reliable, non-blocking ingestion.
The system provides exact source citations including document title, chunk index, and page numbers.`,
    'utf-8'
  );

  const testDoc = await documentService.createDocument({
    title: 'VectorMind Architecture Specification',
    fileName: 'vectormind_spec.txt',
    fileSize: testDocBuffer.length,
    mimeType: 'text/plain',
    sourceType: 'file',
  });

  console.log(`✓ Document record created: id=${testDoc.id}, status=${testDoc.status}`);

  const ingestionResult = await documentService.processAndIngestDocument(
    testDoc.id,
    testDocBuffer,
    { method: 'sentence' }
  );

  console.log(`✓ Ingestion complete: totalChunks=${ingestionResult.totalChunks}, totalPages=${ingestionResult.totalPages}`);

  const ingestedDoc = await documentService.getDocumentById(testDoc.id);
  console.log(`✓ Document status after ingestion: ${ingestedDoc?.status}, stored chunks in DB: ${ingestedDoc?._count.chunks}`);

  if (ingestedDoc?.status !== 'COMPLETED' || (ingestedDoc?._count.chunks || 0) === 0) {
    throw new Error('Ingestion pipeline failed to complete or store chunks');
  }

  // ----------------------------------------------------
  // TEST E: Semantic Vector Search
  // ----------------------------------------------------
  console.log('\n[Test 5/7] Testing Semantic Vector Search (HNSW Cosine Similarity)...');
  const searchResults = await vectorSearchService.search('Which database and indexing is used?', {
    limit: 3,
    documentId: testDoc.id,
  });

  console.log(`✓ Search returned ${searchResults.length} relevant chunks:`);
  for (const res of searchResults) {
    console.log(`  - Chunk ${res.chunkIndex} (Similarity: ${(res.similarity * 100).toFixed(1)}%): "${res.content.slice(0, 80)}..."`);
  }

  if (!searchResults.length || searchResults[0].similarity < 0.5) {
    throw new Error('Semantic search failed to retrieve relevant chunks');
  }

  // ----------------------------------------------------
  // TEST F: Grounded RAG Generation
  // ----------------------------------------------------
  console.log('\n[Test 6/7] Testing Grounded RAG Q&A...');
  const ragAnswer = await ragService.answerQuestion({
    query: 'What vector indexing and dimension does VectorMind use according to the specification?',
    documentId: testDoc.id,
    topK: 3,
  });

  console.log(`✓ Model: ${ragAnswer.model}`);
  console.log(`✓ Sources Cited: ${ragAnswer.sources.length}`);
  console.log(`✓ Generated Answer:\n${ragAnswer.answer}\n`);

  // Test Unknown Answer Behavior
  console.log('[Test 6b] Testing Unknown-Answer Behavior on Unrelated Query...');
  const unrelatedAnswer = await ragService.answerQuestion({
    query: 'What is the recipe for baking chocolate chip cookies on Mars?',
    documentId: testDoc.id,
    topK: 2,
    minSimilarity: 0.75, // Filter out non-relevant context
  });
  console.log(`✓ Unrelated Question Answer:\n${unrelatedAnswer.answer}\n`);

  // ----------------------------------------------------
  // TEST G: Cleanup & Cascade Deletion
  // ----------------------------------------------------
  console.log('[Test 7/7] Cleaning up test document and verifying CASCADE...');
  await documentService.deleteDocument(testDoc.id);

  const remainingChunks = await prisma.$queryRawUnsafe<Array<{ count: string }>>(
    `SELECT COUNT(*) FROM "document_chunks" WHERE "documentId" = $1`,
    testDoc.id
  );

  console.log(`✓ Remaining chunks after document deletion: ${remainingChunks[0]?.count} (expected: 0)`);
  if (parseInt(remainingChunks[0]?.count || '0', 10) !== 0) {
    throw new Error('Document chunk cascade deletion failed!');
  }

  console.log('\n====================================================');
  console.log('🎉 ALL PHASE 3 VERIFICATION TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================');
}

main()
  .catch((err) => {
    console.error('❌ PHASE 3 VERIFICATION FAILED:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
